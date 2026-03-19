const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT = process.env.PASSWORD_SALT || 'educainclusiva-salt-2026';
const SECRET = process.env.JWT_SECRET || 'educainclusiva-jwt-secret-2026';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

async function readUsers() {
  try {
    const r = await fetch(
      `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`,
      { headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY } }
    );
    const data = await r.json();
    return Array.isArray(data.record) ? data.record.filter(u => u.username) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fetch(
    `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`,
    {
      method: 'PUT',
      headers: {
        'X-Master-Key': process.env.JSONBIN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(users),
    }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Preencha usuário e senha.' });

  let users = await readUsers();

  // Primeiro acesso: cria admin padrão
  if (users.length === 0) {
    users = [{
      id: '1',
      username: 'admin',
      password: hashPwd('admin'),
      name: 'Administrador',
      role: 'admin',
      firstLogin: true,
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
    }];
    await writeUsers(users);
  }

  const user = users.find(u => u.username === username && u.active !== false);
  if (!user || user.password !== hashPwd(password)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );

  res.status(200).json({
    token,
    user: {
      username: user.username,
      name: user.name,
      role: user.role,
      firstLogin: user.firstLogin === true,
    },
  });
};
