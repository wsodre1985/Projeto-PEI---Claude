/* =============================================
   EducaInclusiva — PEI Automator
   Frontend Logic
   ============================================= */

// Estado global
let currentPEI = null;
let currentStudentData = null;
let selectedFile = null;
let schoolLogoUrl = null;

// ---- NAVEGAÇÃO ----

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(id);
  if (screen) {
    screen.style.display = (id === 'screen-landing') ? 'flex' : 'block';
    screen.classList.add('active');
  }
  document.getElementById('result-actions').style.display =
    id === 'screen-result' ? 'flex' : 'none';
}

function goToLanding() { showScreen('screen-landing'); }
function goToForm() { showScreen('screen-form'); }
function goToUpload() {
  const nome = document.getElementById('nome').value.trim();
  if (!nome) {
    alert('Por favor, informe o nome do aluno.');
    document.getElementById('nome').focus();
    return;
  }

  // Logo da escola
  const logoInput = document.getElementById('school-logo');
  if (logoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = e => { schoolLogoUrl = e.target.result; };
    reader.readAsDataURL(logoInput.files[0]);
  }

  showScreen('screen-upload');
}

// ---- UPLOAD ----

function onFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-selected').style.display = 'flex';
  document.getElementById('btn-analisar').disabled = false;
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('upload-area');
  if (!area) return;

  area.addEventListener('dragover', e => {
    e.preventDefault();
    area.classList.add('dragging');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragging'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      document.getElementById('file-name').textContent = file.name;
      document.getElementById('file-selected').style.display = 'flex';
      document.getElementById('btn-analisar').disabled = false;
    }
  });
});

// ---- ANÁLISE COM IA ----

async function analisarPEI() {
  if (!selectedFile) return;

  showScreen('screen-loading');

  try {
    // Coleta dados do aluno
    currentStudentData = {
      nome: document.getElementById('nome').value,
      data_nascimento: document.getElementById('data_nascimento').value,
      idade: document.getElementById('idade').value,
      serie: document.getElementById('serie').value,
      turma: document.getElementById('turma').value,
      turno: document.getElementById('turno').value,
      bimestre: document.getElementById('bimestre').value,
      escola: document.getElementById('escola').value,
      nome_mae: document.getElementById('nome_mae').value,
      nome_pai: document.getElementById('nome_pai').value,
      prof_regente: document.getElementById('prof_regente').value,
      prof_apoio: document.getElementById('prof_apoio').value,
      coordenacao: document.getElementById('coordenacao').value,
    };

    // Converte arquivo para base64
    const base64 = await fileToBase64(selectedFile);
    const mimeType = selectedFile.type;

    // Chama a API
    const response = await fetch('/api/gerar-pei', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentData: currentStudentData,
        laudoBase64: base64,
        laudoMimeType: mimeType,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao gerar o PEI.');
    }

    currentPEI = data.pei;
    renderResult();
    showScreen('screen-result');

  } catch (err) {
    showScreen('screen-upload');
    showError(err.message);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      // Remove o prefixo "data:...;base64,"
      const result = e.target.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showError(msg) {
  const existing = document.querySelector('.error-msg');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.textContent = '⚠ ' + msg;
  document.querySelector('#screen-upload .card').appendChild(div);
}

// ---- RENDERIZAÇÃO DO PEI ----

function renderResult() {
  if (!currentPEI) return;
  renderSidebar();
  renderPEIDocument();
}

function renderSidebar() {
  const pei = currentPEI;

  // CIDs
  const cidsEl = document.getElementById('cids-list');
  cidsEl.innerHTML = '';
  const cids = pei.diagnosticos?.cids || [];
  if (cids.length === 0) {
    cidsEl.innerHTML = '<span class="cid-tag">Não identificado</span>';
  } else {
    cids.forEach(cid => {
      const tag = document.createElement('span');
      tag.className = 'cid-tag';
      tag.textContent = cid;
      cidsEl.appendChild(tag);
    });
  }

  // Metas
  const metasEl = document.getElementById('metas-list');
  metasEl.innerHTML = '';
  const areas = pei.areas || {};
  const areaLabels = {
    cognitiva: 'Acadêmico',
    motora: 'Motor',
    comunicacao: 'Comunicação',
    social_emocional: 'Social/Emocional',
  };

  Object.entries(areas).forEach(([key, area]) => {
    const metas = area.metas || [];
    metas.forEach(meta => {
      const item = document.createElement('div');
      item.className = 'meta-item';
      item.innerHTML = `
        <div class="meta-area">${areaLabels[key] || key}</div>
        <p>${meta.descricao}</p>
        <button class="meta-edit-btn" onclick="editMeta(this)" title="Editar">✏</button>
      `;
      metasEl.appendChild(item);
    });
  });
}

function editMeta(btn) {
  const item = btn.parentElement;
  const p = item.querySelector('p');
  const original = p.textContent;
  const input = document.createElement('textarea');
  input.value = original;
  input.style.cssText = 'width:100%;font-size:12px;border:1px solid #ccc;border-radius:4px;padding:6px;resize:vertical;font-family:inherit;';
  p.replaceWith(input);
  input.focus();
  btn.textContent = '✓';
  btn.onclick = () => {
    const newP = document.createElement('p');
    newP.textContent = input.value;
    input.replaceWith(newP);
    btn.textContent = '✏';
    btn.onclick = () => editMeta(btn);
    // Atualiza o documento PEI
    renderPEIDocument();
  };
}

function addMeta() {
  const metasEl = document.getElementById('metas-list');
  const item = document.createElement('div');
  item.className = 'meta-item';
  item.innerHTML = `
    <div class="meta-area">Nova Meta</div>
    <p contenteditable="true" style="outline:1px dashed #ccc;padding:2px;border-radius:3px;">Clique para editar a meta...</p>
    <button class="meta-edit-btn" onclick="this.parentElement.remove()" title="Remover">✕</button>
  `;
  metasEl.appendChild(item);
  item.querySelector('p').focus();
}

function renderPEIDocument() {
  const doc = document.getElementById('pei-document');
  const p = currentPEI;
  const s = currentStudentData;

  const dataHoje = new Date().toLocaleDateString('pt-BR');

  // Formata data de nascimento
  let dataNasc = s.data_nascimento;
  if (dataNasc) {
    const parts = dataNasc.split('-');
    if (parts.length === 3) dataNasc = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Helper: lista para HTML
  const lista = arr => {
    if (!arr || arr.length === 0) return '—';
    return '<ul>' + arr.map(i => `<li>${i}</li>`).join('') + '</ul>';
  };

  // Helper: metas de uma área
  const renderMetas = (area) => {
    if (!area || !area.metas || area.metas.length === 0) return '—';
    return area.metas.map((m, i) => `
      <strong>Meta ${i + 1}:</strong> ${m.descricao}<br>
      <em>Estratégias:</em> ${(m.estrategias || []).join('; ')}<br>
      <em>Recursos:</em> ${(m.recursos || []).join('; ')}<br>
      <em>Prazo:</em> ${m.prazo || '—'}
    `).join('<br><br>');
  };

  // Logo
  const logoHTML = schoolLogoUrl
    ? `<img src="${schoolLogoUrl}" class="pei-school-logo" alt="Logo">`
    : '';

  doc.innerHTML = `
    <!-- PÁGINA 1: IDENTIFICAÇÃO E DIAGNÓSTICO -->
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
        <tr>
          <td colspan="3" class="cell-section">IDENTIFICAÇÃO DO ALUNO</td>
        </tr>
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
        <tr>
          <td colspan="2" class="cell-section">DIAGNÓSTICOS CLÍNICOS</td>
        </tr>
        <tr>
          <td class="cell-label" style="width:35%">PARECER NEUROLÓGICO:</td>
          <td>${p.diagnosticos?.parecer_neurologico || '—'}</td>
        </tr>
        <tr>
          <td class="cell-label">PARECER DE OUTROS ESPECIALISTAS:<br><small>(psicólogo, psicopedagogo, fonoaudiólogo, outros)</small></td>
          <td>${p.diagnosticos?.parecer_outros || '—'}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td colspan="2" class="cell-section">ATENDIMENTO DE ESPECIALISTAS</td>
        </tr>
        <tr>
          <td class="cell-label" style="width:35%">TIPO DE ATENDIMENTO:</td>
          <td>${p.atendimento_especialistas?.modalidades || '—'}</td>
        </tr>
        <tr>
          <td class="cell-label">FREQUÊNCIA:</td>
          <td>${p.atendimento_especialistas?.frequencia || '—'}</td>
        </tr>
        <tr>
          <td class="cell-label">OBSERVAÇÕES:</td>
          <td>${p.atendimento_especialistas?.descricao || '—'}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td class="cell-section">POTENCIALIDADES DO ALUNO</td>
        </tr>
        <tr>
          <td style="min-height:30mm">${p.potencialidades || '—'}</td>
        </tr>
      </table>
    </div>

    <!-- PÁGINA 2: METAS E ESTRATÉGIAS -->
    <div class="pei-page">
      <div class="pei-main-title">METAS E ESTRATÉGIAS PEDAGÓGICAS</div>
      <div style="font-size:8pt;text-align:right;margin-bottom:4px">
        Aluno(a): <strong>${s.nome || '—'}</strong> | ${s.serie || ''} | ${s.bimestre || ''}
      </div>

      <table class="pei-table">
        <tr>
          <td colspan="2" class="cell-area-header">${p.areas?.cognitiva?.titulo || 'Área Cognitiva / Acadêmica'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel" style="width:35%">Habilidades Atuais:</td>
          <td>${p.areas?.cognitiva?.habilidades_atuais || '—'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel">Metas e Estratégias:</td>
          <td>${renderMetas(p.areas?.cognitiva)}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td colspan="2" class="cell-area-header">${p.areas?.motora?.titulo || 'Área Motora'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel" style="width:35%">Habilidades Atuais:</td>
          <td>${p.areas?.motora?.habilidades_atuais || '—'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel">Metas e Estratégias:</td>
          <td>${renderMetas(p.areas?.motora)}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td colspan="2" class="cell-area-header">${p.areas?.comunicacao?.titulo || 'Área de Comunicação e Linguagem'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel" style="width:35%">Habilidades Atuais:</td>
          <td>${p.areas?.comunicacao?.habilidades_atuais || '—'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel">Metas e Estratégias:</td>
          <td>${renderMetas(p.areas?.comunicacao)}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td colspan="2" class="cell-area-header">${p.areas?.social_emocional?.titulo || 'Área Social, Emocional e Comportamental'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel" style="width:35%">Habilidades Atuais:</td>
          <td>${p.areas?.social_emocional?.habilidades_atuais || '—'}</td>
        </tr>
        <tr>
          <td class="cell-sublabel">Metas e Estratégias:</td>
          <td>${renderMetas(p.areas?.social_emocional)}</td>
        </tr>
      </table>
    </div>

    <!-- PÁGINA 3: ADAPTAÇÕES E ASSINATURAS -->
    <div class="pei-page">
      <div class="pei-main-title">ADAPTAÇÕES, AVALIAÇÃO E ASSINATURAS</div>
      <div style="font-size:8pt;text-align:right;margin-bottom:4px">
        Aluno(a): <strong>${s.nome || '—'}</strong> | ${s.serie || ''} | ${s.bimestre || ''}
      </div>

      <table class="pei-table">
        <tr>
          <td class="cell-section">ADAPTAÇÕES CURRICULARES</td>
        </tr>
        <tr>
          <td>${lista(p.adaptacoes_curriculares)}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td class="cell-section">TECNOLOGIAS ASSISTIVAS E RECURSOS PEDAGÓGICOS</td>
        </tr>
        <tr>
          <td>${lista(p.tecnologias_assistivas)}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td class="cell-section">ORIENTAÇÕES PARA A FAMÍLIA</td>
        </tr>
        <tr>
          <td style="min-height:20mm">${p.orientacoes_familia || '—'}</td>
        </tr>
      </table>

      <table class="pei-table">
        <tr>
          <td class="cell-section">AVALIAÇÃO E ACOMPANHAMENTO DO PROGRESSO</td>
        </tr>
        <tr>
          <td style="min-height:20mm">${p.avaliacao || '—'}</td>
        </tr>
      </table>

      <div class="pei-signatures">
        <div class="pei-signature-box">
          <div class="pei-signature-line">
            Professor(a) Regente<br><small>${s.prof_regente || ''}</small>
          </div>
        </div>
        <div class="pei-signature-box">
          <div class="pei-signature-line">
            Prof(a). AEE / Apoio<br><small>${s.prof_apoio || ''}</small>
          </div>
        </div>
        <div class="pei-signature-box">
          <div class="pei-signature-line">
            Coordenação Pedagógica<br><small>${s.coordenacao || ''}</small>
          </div>
        </div>
        <div class="pei-signature-box">
          <div class="pei-signature-line">
            Responsável pelo Aluno<br>&nbsp;
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:8mm;font-size:8pt;color:#666;border-top:1px solid #ddd;padding-top:6px">
        Documento gerado em ${dataHoje} — Em conformidade com a LGPD e com as Diretrizes da Educação Inclusiva (Lei 13.146/2015)
      </div>
    </div>
  `;
}

// ---- REHASH ----
async function rehash() {
  if (!selectedFile || !currentStudentData) return;
  showScreen('screen-loading');
  await analisarPEI();
}

// ---- EXPORTAÇÕES ----

function printPEI() {
  window.print();
}

function downloadPDF() {
  const element = document.getElementById('pei-document');
  const nomeAluno = currentStudentData?.nome?.replace(/\s+/g, '_') || 'aluno';
  const filename = `PEI_${nomeAluno}.pdf`;

  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save();
  } else {
    alert('Biblioteca de PDF ainda carregando. Tente usar "Imprimir" e salvar como PDF.');
  }
}

function downloadWord() {
  const pei = currentPEI;
  const s = currentStudentData;
  const dataHoje = new Date().toLocaleDateString('pt-BR');

  const lista = arr => arr ? arr.map(i => `• ${i}`).join('\n') : '—';
  const renderMetasText = (area) => {
    if (!area || !area.metas) return '—';
    return area.metas.map((m, i) =>
      `Meta ${i+1}: ${m.descricao}\nEstratégias: ${(m.estrategias||[]).join('; ')}\nRecursos: ${(m.recursos||[]).join('; ')}\nPrazo: ${m.prazo||'—'}`
    ).join('\n\n');
  };

  const content = `
PLANO EDUCACIONAL INDIVIDUALIZADO (PEI)
========================================

IDENTIFICAÇÃO DO ALUNO
-----------------------
Aluno(a): ${s.nome || '—'}
Idade: ${s.idade || '—'} | Data de Nascimento: ${s.data_nascimento || '—'}
Série: ${s.serie || '—'} | Turma: ${s.turma || '—'} | Turno: ${s.turno || '—'}
Bimestre: ${s.bimestre || '—'} | Data: ${dataHoje}
Escola: ${s.escola || '—'}
Mãe: ${s.nome_mae || '—'} | Pai: ${s.nome_pai || '—'}
Professora: ${s.prof_regente || '—'} | Prof. de Apoio: ${s.prof_apoio || '—'} | Coordenação: ${s.coordenacao || '—'}

DIAGNÓSTICOS CLÍNICOS
----------------------
Parecer Neurológico:
${pei.diagnosticos?.parecer_neurologico || '—'}

Parecer de Outros Especialistas:
${pei.diagnosticos?.parecer_outros || '—'}

CIDs: ${(pei.diagnosticos?.cids || []).join(', ') || '—'}

ATENDIMENTO DE ESPECIALISTAS
-----------------------------
Tipo: ${pei.atendimento_especialistas?.modalidades || '—'}
Frequência: ${pei.atendimento_especialistas?.frequencia || '—'}
${pei.atendimento_especialistas?.descricao || ''}

POTENCIALIDADES DO ALUNO
-------------------------
${pei.potencialidades || '—'}

ÁREA COGNITIVA / ACADÊMICA
---------------------------
Habilidades Atuais: ${pei.areas?.cognitiva?.habilidades_atuais || '—'}
${renderMetasText(pei.areas?.cognitiva)}

ÁREA MOTORA
-----------
Habilidades Atuais: ${pei.areas?.motora?.habilidades_atuais || '—'}
${renderMetasText(pei.areas?.motora)}

ÁREA DE COMUNICAÇÃO E LINGUAGEM
---------------------------------
Habilidades Atuais: ${pei.areas?.comunicacao?.habilidades_atuais || '—'}
${renderMetasText(pei.areas?.comunicacao)}

ÁREA SOCIAL, EMOCIONAL E COMPORTAMENTAL
-----------------------------------------
Habilidades Atuais: ${pei.areas?.social_emocional?.habilidades_atuais || '—'}
${renderMetasText(pei.areas?.social_emocional)}

ADAPTAÇÕES CURRICULARES
------------------------
${lista(pei.adaptacoes_curriculares)}

TECNOLOGIAS ASSISTIVAS
-----------------------
${lista(pei.tecnologias_assistivas)}

ORIENTAÇÕES PARA A FAMÍLIA
----------------------------
${pei.orientacoes_familia || '—'}

AVALIAÇÃO E ACOMPANHAMENTO
----------------------------
${pei.avaliacao || '—'}

________________________________________    ________________________________________
Professor(a) Regente                        Prof(a). AEE / Apoio
${s.prof_regente || ''}                     ${s.prof_apoio || ''}

________________________________________    ________________________________________
Coordenação Pedagógica                      Responsável pelo Aluno
${s.coordenacao || ''}

Documento gerado em ${dataHoje} — Em conformidade com a LGPD e com a Lei 13.146/2015
  `.trim();

  const blob = new Blob([content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nomeAluno = s.nome?.replace(/\s+/g, '_') || 'aluno';
  a.href = url;
  a.download = `PEI_${nomeAluno}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
