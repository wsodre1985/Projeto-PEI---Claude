const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT = process.env.PASSWORD_SALT || 'educainclusiva-salt-2026';
const SECRET = process.env.JWT_SECRET || 'educainclusiva-jwt-secret-2026';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

function verifyAdmin(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const decoded = jwt.verify(token, SECRET);
  if (decoded.role !== 'admin') throw new Error('Acesso restrito ao administrador.');
  return decoded;
}

async function readUsers() {
  const r = await fetch(
    `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`,
    { headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY } }
  );
  const data = await r.json();
  return Array.isArray(data.record) ? data.record.filter(u => u.username) : [];
}

async function writeUsers(users) {
  await fetch(
    `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`,
    {
      method: 'PUT',
      headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(users),
    }
  );
}

function safeUser(u) {
  return {
    id: u.id, username: u.username, name: u.name,
    role: u.role, active: u.active, createdAt: u.createdAt, firstLogin: u.firstLogin,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try { verifyAdmin(req); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  const users = await readUsers();

  // Listar usuários
  if (req.method === 'GET') {
    return res.status(200).json(users.map(safeUser));
  }

  // Criar usuário
  if (req.method === 'POST') {
    const { username, password, name, role } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    if (users.find(u => u.username === username))
      return res.status(409).json({ error: 'Este usuário já existe.' });

    users.push({
      id: Date.now().toString(),
      username: username.toLowerCase().trim(),
      password: hashPwd(password),
      name: name || username,
      role: role === 'admin' ? 'admin' : 'user',
      active: true,
      firstLogin: true,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    await writeUsers(users);
    return res.status(201).json({ success: true });
  }

  // Excluir usuário
  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (users[idx].role === 'admin' && users.filter(u => u.role === 'admin' && u.active).length <= 1)
      return res.status(400).json({ error: 'Não é possível remover o único administrador.' });
    users.splice(idx, 1);
    await writeUsers(users);
    return res.status(200).json({ success: true });
  }

  // Resetar senha (admin define nova senha para qualquer usuário)
  if (req.method === 'PATCH') {
    const { id, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado.' });
    users[idx].password = hashPwd(newPassword);
    users[idx].firstLogin = true; // Força troca no próximo login
    await writeUsers(users);
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
};
