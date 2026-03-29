// api/settings.js
// POST /api/settings
// ログイン中クライアントの通知・アラート設定を保存する

const supabaseAdmin = require('../lib/supabaseAdmin');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
    .from('clients').select('id, settings').eq('email', userEmail).single();
  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  // === GET: 現在の設定を返す ===
  if (req.method === 'GET') {
    return res.status(200).json({ settings: client.settings || {} });
  }

  // === POST: 設定を保存 ===
  if (req.method === 'POST') {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings オブジェクトが必要です' });
    }

    // バリデーション・サニタイズ
    const sanitized = {
      alertEmail:       settings.alertEmail === false ? false : true,
      weeklyEmail:      settings.weeklyEmail === false ? false : true,
      alertThreshold:   Math.min(30, Math.max(5, parseInt(settings.alertThreshold, 10) || 10)),
      measureFreq:      ['daily', 'weekly'].includes(settings.measureFreq) ? settings.measureFreq : 'daily',
    };

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({ settings: sanitized, updated_at: new Date().toISOString() })
      .eq('id', client.id);

    if (updateError) {
      console.error('[settings] 更新エラー:', updateError);
      return res.status(500).json({ error: '設定の保存に失敗しました' });
    }

    console.log(`[settings] ${userEmail}: 設定を更新しました`, sanitized);
    return res.status(200).json({ success: true, settings: sanitized });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
