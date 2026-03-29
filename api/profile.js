// api/profile.js
// POST /api/profile
// ログイン中クライアントのプロフィール（表示名・役職・カラー）を更新する

const supabaseAdmin = require('../lib/supabaseAdmin');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // === JWT 認証 ===
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let userEmail;
  try {
    const payloadBase64 = token.split('.')[1];
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const payload = JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf-8'));
    userEmail = payload.email || payload.user_metadata?.email;
    if (!userEmail) throw new Error('email not found');
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'トークンが無効です' });
  }

  // === クライアント確認 ===
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients').select('id').eq('email', userEmail).single();
  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  // === 入力バリデーション ===
  const { user_name, user_role, color } = req.body || {};
  if (!user_name || typeof user_name !== 'string' || user_name.trim() === '') {
    return res.status(400).json({ error: '表示名（user_name）は必須です' });
  }

  // color バリデーション（16進カラーコード）
  const validColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined;

  // === DB 更新 ===
  const updatePayload = {
    user_name: user_name.trim(),
    user_role: (user_role || '').trim(),
    updated_at: new Date().toISOString(),
  };
  if (validColor) updatePayload.color = validColor;

  // short（アバター文字）も更新
  updatePayload.short = user_name.trim().charAt(0);

  const { error: updateError } = await supabaseAdmin
    .from('clients')
    .update(updatePayload)
    .eq('id', client.id);

  if (updateError) {
    console.error('[profile] 更新エラー:', updateError);
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
  }

  console.log(`[profile] ${userEmail}: プロフィールを更新しました`);
  return res.status(200).json({ success: true, ...updatePayload });
};
