/* =============================================
   EducaInclusiva — PEI Automator
   ============================================= */

// Estado global
let authToken = null;
let authUser = null;
let currentPEI = null;
let currentStudentData = null;
let selectedFile = null;
let schoolLogoUrl = null;
let resetTargetId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Carrega sessão salva
  authToken = localStorage.getItem('pei_token');
  try { authUser = JSON.parse(localStorage.getItem('pei_user')); } catch { authUser = null; }

  if (!isLoggedIn()) {
    show('screen-login');
  } else if (authUser?.firstLogin) {
    showApp();
    show('screen-change-password');
  } else {
    showApp();
    show('screen-landing');
  }

  // Drag and drop no upload
  const area = document.getElementById('upload-area');
  if (area) {
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragging'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragging'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('dragging');
      const file = e.dataTransfer.files[0];
      if (file) setFile(file);
    });
  }
});

// ============================================
// CONTROLE DE TELAS
// ============================================

function show(screenId) {
  const ids = [
    'screen-login', 'screen-change-password', 'screen-landing',
    'screen-form', 'screen-upload', 'screen-loading', 'screen-result', 'screen-admin',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(screenId);
  if (target) {
    const flexIds = ['screen-login', 'screen-change-password', 'screen-loading'];
    target.style.display = flexIds.includes(screenId) ? 'flex' : 'block';
  }

  // Botões de resultado no header
  const ra = document.getElementById('result-actions');
  if (ra) ra.style.display = screenId === 'screen-result' ? 'flex' : 'none';
}

function showApp() {
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('user-display').textContent = authUser?.name || authUser?.username || '';
  document.getElementById('btn-admin').style.display = authUser?.role === 'admin' ? 'inline-block' : 'none';
}

function hideApp() {
  document.getElementById('app-header').style.display = 'none';
}

function goToLanding() { show('screen-landing'); }
function goToForm()    { show('screen-form'); }
function goToAdmin()   { show('screen-admin'); loadUsers(); }

function goToUpload() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) { alert('Por favor, informe o nome do aluno.'); return; }
  const logoInput = document.getElementById('school-logo');
  if (logoInput?.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { schoolLogoUrl = e.target.result; };
    reader.readAsDataURL(logoInput.files[0]);
  }
  show('screen-upload');
}

// ============================================
// AUTH
// ============================================

function isLoggedIn() {
  if (!authToken || !authUser) return false;
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch { return false; }
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'Preencha usuário e senha.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro ao fazer login.');

    authToken = data.token;
    authUser = data.user;
    localStorage.setItem('pei_token', authToken);
    localStorage.setItem('pei_user', JSON.stringify(authUser));

    showApp();
    if (data.user.firstLogin) {
      show('screen-change-password');
    } else {
      show('screen-landing');
    }
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

async function doChangePassword() {
  const oldPwd    = document.getElementById('chpwd-old').value;
  const newPwd    = document.getElementById('chpwd-new').value;
  const confirm   = document.getElementById('chpwd-confirm').value;
  const errEl     = document.getElementById('chpwd-error');
  errEl.style.display = 'none';

  if (newPwd !== confirm) {
    errEl.textContent = 'As novas senhas não coincidem.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);

    authUser.firstLogin = false;
    localStorage.setItem('pei_user', JSON.stringify(authUser));
    alert('Senha alterada com sucesso!');
    show('screen-landing');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function doLogout() {
  localStorage.removeItem('pei_token');
  localStorage.removeItem('pei_user');
  authToken = null;
  authUser = null;
  hideApp();
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  show('screen-login');
}

// ============================================
// PAINEL ADMIN
// ============================================

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">Carregando...</td></tr>';
  try {
    const r = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer ' + authToken } });
    const users = await r.json();
    if (!r.ok) throw new Error(users.error);
    tbody.innerHTML = users.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">Nenhum usuário.</td></tr>'
      : users.map(u => `
          <tr>
            <td><strong>${u.username}</strong>${u.username === authUser.username ? ' <span style="font-size:10px;color:#aaa">(você)</span>' : ''}</td>
            <td>${u.name || '—'}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? 'Admin' : 'Usuário'}</span></td>
            <td>${u.createdAt || '—'}</td>
            <td><span class="badge badge-active">Ativo</span></td>
            <td>
              <button class="btn-table" onclick="openResetModal('${u.id}','${u.username}')">🔑 Senha</button>
              ${u.username !== authUser.username
                ? `<button class="btn-table btn-table-danger" onclick="deleteUser('${u.id}','${u.username}')">🗑 Excluir</button>`
                : ''}
            </td>
          </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;padding:16px">${e.message}</td></tr>`;
  }
}

function showAddUserForm() {
  document.getElementById('add-user-form').style.display = 'block';
  document.getElementById('new-username').focus();
}

function cancelAddUser() {
  document.getElementById('add-user-form').style.display = 'none';
  document.getElementById('add-user-error').style.display = 'none';
  ['new-username','new-name','new-password'].forEach(id => document.getElementById(id).value = '');
}

async function createUser() {
  const username = document.getElementById('new-username').value.trim();
  const name     = document.getElementById('new-name').value.trim();
  const password = document.getElementById('new-password').value;
  const role     = document.getElementById('new-role').value;
  const errEl    = document.getElementById('add-user-error');
  errEl.style.display = 'none';
  try {
    const r = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ username, name, password, role }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    cancelAddUser();
    loadUsers();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Excluir o usuário "${username}"? Esta ação não pode ser desfeita.`)) return;
  try {
    const r = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ id }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    loadUsers();
  } catch (e) { alert('Erro: ' + e.message); }
}

function openResetModal(id, username) {
  resetTargetId = id;
  document.getElementById('modal-reset-label').textContent = 'Usuário: ' + username;
  document.getElementById('reset-new-password').value = '';
  document.getElementById('reset-error').style.display = 'none';
  document.getElementById('modal-reset').style.display = 'flex';
}

function closeResetModal() {
  document.getElementById('modal-reset').style.display = 'none';
  resetTargetId = null;
}

async function confirmReset() {
  const newPassword = document.getElementById('reset-new-password').value;
  const errEl = document.getElementById('reset-error');
  errEl.style.display = 'none';
  try {
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ id: resetTargetId, newPassword }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    closeResetModal();
    alert('Senha redefinida. O usuário deverá alterá-la no próximo acesso.');
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

// ============================================
// UPLOAD
// ============================================

function onFileSelected(input) {
  const file = input.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-selected').style.display = 'flex';
  document.getElementById('btn-analisar').disabled = false;
}

// ============================================
// ANÁLISE COM IA
// ============================================

async function analisarPEI() {
  if (!selectedFile) return;
  show('screen-loading');
  try {
    currentStudentData = {
      nome:             document.getElementById('nome').value,
      data_nascimento:  document.getElementById('data_nascimento').value,
      idade:            document.getElementById('idade').value,
      serie:            document.getElementById('serie').value,
      turma:            document.getElementById('turma').value,
      turno:            document.getElementById('turno').value,
      bimestre:         document.getElementById('bimestre').value,
      escola:           document.getElementById('escola').value,
      nome_mae:         document.getElementById('nome_mae').value,
      nome_pai:         document.getElementById('nome_pai').value,
      prof_regente:     document.getElementById('prof_regente').value,
      prof_apoio:       document.getElementById('prof_apoio').value,
      coordenacao:      document.getElementById('coordenacao').value,
    };

    const base64 = await fileToBase64(selectedFile);

    const response = await fetch('/api/gerar-pei', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentData: currentStudentData,
        laudoBase64: base64,
        laudoMimeType: selectedFile.type,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao gerar o PEI.');

    currentPEI = data.pei;
    renderSidebar();
    renderPEIDocument();
    show('screen-result');
  } catch (err) {
    show('screen-upload');
    showError(err.message);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showError(msg) {
  document.querySelectorAll('.error-msg').forEach(e => e.remove());
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.textContent = '⚠ ' + msg;
  document.querySelector('#screen-upload .card')?.appendChild(div);
}

async function rehash() {
  if (!selectedFile || !currentStudentData) return;
  await analisarPEI();
}

// ============================================
// SIDEBAR DO RESULTADO
// ============================================

function renderSidebar() {
  const pei = currentPEI;

  // CIDs
  const cidsEl = document.getElementById('cids-list');
  cidsEl.innerHTML = '';
  (pei.diagnosticos?.cids || []).forEach(cid => {
    const tag = document.createElement('span');
    tag.className = 'cid-tag';
    tag.textContent = cid;
    cidsEl.appendChild(tag);
  });
  if (!cidsEl.children.length) cidsEl.innerHTML = '<span class="cid-tag">Não identificado</span>';

  // Metas
  const metasEl = document.getElementById('metas-list');
  metasEl.innerHTML = '';
  const labels = { cognitiva: 'Acadêmico', motora: 'Motor', comunicacao: 'Comunicação', social_emocional: 'Social/Emocional' };
  Object.entries(pei.areas || {}).forEach(([key, area]) => {
    (area.metas || []).forEach(meta => {
      const item = document.createElement('div');
      item.className = 'meta-item';
      item.innerHTML = `
        <div class="meta-area">${labels[key] || key}</div>
        <p>${meta.descricao}</p>
        <button class="meta-edit-btn" title="Editar">✏</button>`;
      item.querySelector('.meta-edit-btn').onclick = () => editMeta(item);
      metasEl.appendChild(item);
    });
  });
}

function editMeta(item) {
  const p = item.querySelector('p');
  const btn = item.querySelector('.meta-edit-btn');
  const input = document.createElement('textarea');
  input.value = p.textContent;
  input.style.cssText = 'width:100%;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:6px;resize:vertical;font-family:inherit;';
  p.replaceWith(input);
  btn.textContent = '✓';
  btn.onclick = () => {
    const newP = document.createElement('p');
    newP.textContent = input.value;
    input.replaceWith(newP);
    btn.textContent = '✏';
    btn.onclick = () => editMeta(item);
  };
}

function addMeta() {
  const metasEl = document.getElementById('metas-list');
  const item = document.createElement('div');
  item.className = 'meta-item';
  item.innerHTML = `
    <div class="meta-area">Nova Meta</div>
    <p contenteditable="true" style="outline:1px dashed #ccc;padding:2px;border-radius:3px;">Clique para editar a meta...</p>
    <button class="meta-edit-btn" title="Remover">✕</button>`;
  item.querySelector('.meta-edit-btn').onclick = () => item.remove();
  metasEl.appendChild(item);
  item.querySelector('p').focus();
}

// ============================================
// DOCUMENTO PEI
// ============================================

function renderPEIDocument() {
  const doc = document.getElementById('pei-document');
  const p = currentPEI;
  const s = currentStudentData;
  const dataHoje = new Date().toLocaleDateString('pt-BR');

  let dataNasc = s.data_nascimento;
  if (dataNasc) {
    const [y, m, d] = dataNasc.split('-');
    if (y && m && d) dataNasc = `${d}/${m}/${y}`;
  }

  const lista = arr => arr?.length
    ? '<ul>' + arr.map(i => `<li>${i}</li>`).join('') + '</ul>'
    : '—';

  const renderMetas = area => {
    if (!area?.metas?.length) return '—';
    return area.metas.map((m, i) => `
      <strong>Meta ${i+1}:</strong> ${m.descricao}<br>
      <em>Estratégias:</em> ${(m.estrategias || []).join('; ')}<br>
      <em>Recursos:</em> ${(m.recursos || []).join('; ')}<br>
      <em>Prazo:</em> ${m.prazo || '—'}
    `).join('<br><br>');
  };

  const logoHTML = schoolLogoUrl
    ? `<img src="${schoolLogoUrl}" class="pei-school-logo" alt="Logo">`
    : '';

  doc.innerHTML = `
    <!-- PÁGINA 1 -->
    <div class="pei-page">
      <div class="pei-school-header">
        ${logoHTML}
        <div class="pei-school-info">
          <div class="pei-school-name">${s.escola || 'Escola Municipal'}</div>
          <div class="pei-school-sub">Atendimento Educacional Especializado — AEE</div>
        </div>
      </div>
      <div class="pei-main-title">PLANO EDUCACIONAL INDIVIDUALIZADO (PEI)</div>
      <table class="pei-table">
        <tr><td colspan="3" class="cell-section">IDENTIFICAÇÃO DO ALUNO</td></tr>
        <tr>
          <td colspan="2"><span class="cell-label">Aluno(a):</span> <strong>${s.nome || '—'}</strong></td>
          <td><span class="cell-label">Idade:</span> ${s.idade || '—'}</td>
        </tr>
        <tr>
          <td><span class="cell-label">Data de Nascimento:</span> ${dataNasc || '—'}</td>
          <td><span class="cell-label">Série:</span> ${s.serie || '—'}</td>
          <td><span class="cell-label">Turma:</span> ${s.turma || '—'}</td>
        </tr>
        <tr>
          <td><span class="cell-label">Turno:</span> ${s.turno || '—'}</td>
          <td><span class="cell-label">Bimestre:</span> ${s.bimestre || '—'}</td>
          <td><span class="cell-label">Data:</span> ${dataHoje}</td>
        </tr>
        <tr>
          <td colspan="2"><span class="cell-label">Mãe:</span> ${s.nome_mae || '—'}</td>
          <td><span class="cell-label">Pai:</span> ${s.nome_pai || '—'}</td>
        </tr>
        <tr>
          <td><span class="cell-label">Professora:</span> ${s.prof_regente || '—'}</td>
          <td><span class="cell-label">Prof. de Apoio:</span> ${s.prof_apoio || '—'}</td>
          <td><span class="cell-label">Coordenação:</span> ${s.coordenacao || '—'}</td>
        </tr>
      </table>
      <table class="pei-table">
        <tr><td colspan="2" class="cell-section">DIAGNÓSTICOS CLÍNICOS</td></tr>
        <tr>
          <td class="cell-label" style="width:35%">PARECER NEUROLÓGICO:</td>
          <td>${p.diagnosticos?.parecer_neurologico || '—'}</td>
        </tr>
        <tr>
          <td class="cell-label">PARECER DE OUTROS ESPECIALISTAS:<br><small>(psicólogo, psicopedagogo, fonoaudiólogo)</small></td>
          <td>${p.diagnosticos?.parecer_outros || '—'}</td>
        </tr>
      </table>
      <table class="pei-table">
        <tr><td colspan="2" class="cell-section">ATENDIMENTO DE ESPECIALISTAS</td></tr>
        <tr><td class="cell-label" style="width:35%">TIPO:</td><td>${p.atendimento_especialistas?.modalidades || '—'}</td></tr>
        <tr><td class="cell-label">FREQUÊNCIA:</td><td>${p.atendimento_especialistas?.frequencia || '—'}</td></tr>
        <tr><td class="cell-label">OBSERVAÇÕES:</td><td>${p.atendimento_especialistas?.descricao || '—'}</td></tr>
      </table>
      <table class="pei-table">
        <tr><td class="cell-section">POTENCIALIDADES DO ALUNO</td></tr>
        <tr><td style="min-height:25mm">${p.potencialidades || '—'}</td></tr>
      </table>
    </div>

    <!-- PÁGINA 2 -->
    <div class="pei-page">
      <div class="pei-main-title">METAS E ESTRATÉGIAS PEDAGÓGICAS</div>
      <div style="font-size:8pt;text-align:right;margin-bottom:4px">
        Aluno(a): <strong>${s.nome || '—'}</strong> | ${s.serie || ''} | ${s.bimestre || ''}
      </div>
      ${['cognitiva','motora','comunicacao','social_emocional'].map(key => `
        <table class="pei-table">
          <tr><td colspan="2" class="cell-area-header">${p.areas?.[key]?.titulo || key}</td></tr>
          <tr><td class="cell-sublabel" style="width:35%">Habilidades Atuais:</td><td>${p.areas?.[key]?.habilidades_atuais || '—'}</td></tr>
          <tr><td class="cell-sublabel">Metas e Estratégias:</td><td>${renderMetas(p.areas?.[key])}</td></tr>
        </table>`).join('')}
    </div>

    <!-- PÁGINA 3 -->
    <div class="pei-page">
      <div class="pei-main-title">ADAPTAÇÕES, AVALIAÇÃO E ASSINATURAS</div>
      <div style="font-size:8pt;text-align:right;margin-bottom:4px">
        Aluno(a): <strong>${s.nome || '—'}</strong> | ${s.serie || ''} | ${s.bimestre || ''}
      </div>
      <table class="pei-table">
        <tr><td class="cell-section">ADAPTAÇÕES CURRICULARES</td></tr>
        <tr><td>${lista(p.adaptacoes_curriculares)}</td></tr>
      </table>
      <table class="pei-table">
        <tr><td class="cell-section">TECNOLOGIAS ASSISTIVAS E RECURSOS PEDAGÓGICOS</td></tr>
        <tr><td>${lista(p.tecnologias_assistivas)}</td></tr>
      </table>
      <table class="pei-table">
        <tr><td class="cell-section">ORIENTAÇÕES PARA A FAMÍLIA</td></tr>
        <tr><td style="min-height:20mm">${p.orientacoes_familia || '—'}</td></tr>
      </table>
      <table class="pei-table">
        <tr><td class="cell-section">AVALIAÇÃO E ACOMPANHAMENTO DO PROGRESSO</td></tr>
        <tr><td style="min-height:20mm">${p.avaliacao || '—'}</td></tr>
      </table>
      <div class="pei-signatures">
        <div class="pei-signature-box"><div class="pei-signature-line">Professor(a) Regente<br><small>${s.prof_regente || ''}</small></div></div>
        <div class="pei-signature-box"><div class="pei-signature-line">Prof(a). AEE / Apoio<br><small>${s.prof_apoio || ''}</small></div></div>
        <div class="pei-signature-box"><div class="pei-signature-line">Coordenação Pedagógica<br><small>${s.coordenacao || ''}</small></div></div>
        <div class="pei-signature-box"><div class="pei-signature-line">Responsável pelo Aluno<br>&nbsp;</div></div>
      </div>
      <div style="text-align:center;margin-top:8mm;font-size:8pt;color:#666;border-top:1px solid #ddd;padding-top:6px">
        Documento gerado em ${dataHoje} — Em conformidade com a LGPD e com a Lei 13.146/2015
      </div>
    </div>
  `;
}

// ============================================
// EXPORTAÇÕES
// ============================================

function printPEI() { window.print(); }

function downloadPDF() {
  const el = document.getElementById('pei-document');
  const nome = currentStudentData?.nome?.replace(/\s+/g, '_') || 'aluno';
  if (typeof html2pdf !== 'undefined') {
    html2pdf().set({
      margin: 0,
      filename: `PEI_${nome}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    }).from(el).save();
  } else {
    alert('Biblioteca de PDF ainda carregando. Use "Imprimir" e salve como PDF.');
  }
}

function downloadWord() {
  const p = currentPEI;
  const s = currentStudentData;
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const lista = arr => arr ? arr.map(i => '• ' + i).join('\n') : '—';
  const metas = area => area?.metas?.map((m, i) =>
    `Meta ${i+1}: ${m.descricao}\nEstratégias: ${(m.estrategias||[]).join('; ')}\nPrazo: ${m.prazo||'—'}`
  ).join('\n\n') || '—';

  const content = `PLANO EDUCACIONAL INDIVIDUALIZADO (PEI)
========================================

Aluno(a): ${s.nome || '—'} | Idade: ${s.idade || '—'}
Série: ${s.serie || '—'} | Turma: ${s.turma || '—'} | Turno: ${s.turno || '—'}
Bimestre: ${s.bimestre || '—'} | Escola: ${s.escola || '—'}
Mãe: ${s.nome_mae || '—'} | Pai: ${s.nome_pai || '—'}
Professora: ${s.prof_regente || '—'} | Apoio: ${s.prof_apoio || '—'} | Coordenação: ${s.coordenacao || '—'}

DIAGNÓSTICO
-----------
Neurológico: ${p.diagnosticos?.parecer_neurologico || '—'}
Outros especialistas: ${p.diagnosticos?.parecer_outros || '—'}
CIDs: ${(p.diagnosticos?.cids||[]).join(', ') || '—'}

POTENCIALIDADES
---------------
${p.potencialidades || '—'}

ÁREA COGNITIVA
${metas(p.areas?.cognitiva)}

ÁREA MOTORA
${metas(p.areas?.motora)}

ÁREA DE COMUNICAÇÃO
${metas(p.areas?.comunicacao)}

ÁREA SOCIAL/EMOCIONAL
${metas(p.areas?.social_emocional)}

ADAPTAÇÕES CURRICULARES
${lista(p.adaptacoes_curriculares)}

TECNOLOGIAS ASSISTIVAS
${lista(p.tecnologias_assistivas)}

ORIENTAÇÕES PARA A FAMÍLIA
${p.orientacoes_familia || '—'}

AVALIAÇÃO
${p.avaliacao || '—'}

Gerado em ${dataHoje} — Em conformidade com a LGPD e Lei 13.146/2015`.trim();

  const blob = new Blob([content], { type: 'application/msword' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `PEI_${(s.nome||'aluno').replace(/\s+/g,'_')}.doc`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
