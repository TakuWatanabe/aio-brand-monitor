// api/admin/auth.js
// POST /api/admin/auth
// 管理者パスワード認証 → トークンを返す

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET が設定されていません' });
  }

  if (password !== adminSecret) {
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  // シンプルなトークン（ADMIN_SECRET をそのまま返す）
  return res.status(200).json({ token: adminSecret });
};
