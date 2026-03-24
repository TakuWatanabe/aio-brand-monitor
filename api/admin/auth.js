// api/admin/auth.js
// POST /api/admin/auth
// 管理者パスワード認証 → 署名付きセッショントークンを返す
//
// 設計方針:
//   - ADMIN_SECRET はレスポンスに含めない
//   - 代わりに HMAC-SHA256 で署名したトークンを発行（有効期限付き）
//   - 検証は verifyAdminToken() で行う（他のエンドポイントには現在 JWT Supabase 認証を使用）

const crypto = require('crypto');

/**
 * ADMIN_SECRET を使って HMAC トークンを生成する
 * payload: { sub: 'admin', exp: <unix timestamp> }
 */
function createAdminToken(secret) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8時間有効
  const payload = Buffer.from(JSON.stringify({ sub: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * トークンを検証して有効なら true を返す
 */
function verifyAdminToken(token, secret) {
  try {
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (sig !== expected) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

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
    // ブルートフォース対策: 認証失敗時に少し遅延
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  const token = createAdminToken(adminSecret);
  return res.status(200).json({ token });
};

module.exports.verifyAdminToken = verifyAdminToken;
