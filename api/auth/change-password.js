const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT = process.env.PASSWORD_SALT || 'educainclusiva-salt-2026';
const SECRET = process.env.JWT_SECRET || 'educainclusiva-jwt-secret-2026';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  let decoded;
  try {
    decoded = jwt.verify(auth, SECRET);
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword)
    return res.status(400).json({ error: 'Campos obrigatórios.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });

  const users = await readUsers();
  const idx = users.findIndex(u => u.username === decoded.username);
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado.' });

  if (users[idx].password !== hashPwd(oldPassword)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  users[idx].password = hashPwd(newPassword);
  users[idx].firstLogin = false;
  await writeUsers(users);

  res.status(200).json({ success: true });
};
