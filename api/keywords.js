// api/keywords.js
// GET  /api/keywords  → キーワード一覧取得
// POST /api/keywords  → キーワード一覧を丸ごと上書き保存（追加・編集・削除）

const supabaseAdmin = require('../lib/supabaseAdmin');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // === 認証 ===
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

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients').select('id, keywords').eq('email', userEmail).single();
  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  // === GET: キーワード一覧を返す ===
  if (req.method === 'GET') {
    return res.status(200).json({ keywords: client.keywords || [] });
  }

  // === POST: キーワード一覧を保存 ===
  if (req.method === 'POST') {
    const { keywords, industry } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'keywords は配列である必要があります' });
    }

    // バリデーション：各キーワードに kw フィールドが必要
    for (const kw of keywords) {
      if (!kw.kw || typeof kw.kw !== 'string' || kw.kw.trim() === '') {
        return res.status(400).json({ error: 'キーワード名（kw）は必須です' });
      }
    }

    // デフォルト値を補完して保存
    const normalized = keywords.map(kw => ({
      kw: kw.kw.trim(),
      vol: kw.vol || '月間--',
      presence: kw.presence ?? 0,
      change: kw.change || '--',
      status: kw.status || 'low',
      google_ai: kw.google_ai ?? null,
      google_organic: kw.google_organic ?? null,
      gsc_impressions: kw.gsc_impressions ?? null,
      gsc_clicks: kw.gsc_clicks ?? null,
      gsc_position: kw.gsc_position ?? null,
    }));

    const updatePayload = { keywords: normalized, updated_at: new Date().toISOString() };
    if (industry && typeof industry === 'string') updatePayload.industry = industry;

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update(updatePayload)
      .eq('id', client.id);

    if (updateError) {
      console.error('[keywords] 保存エラー:', updateError);
      return res.status(500).json({ error: 'キーワードの保存に失敗しました' });
    }

    console.log(`[keywords] ${userEmail}: ${normalized.length}件のキーワードを保存しました${industry ? ' / 業種: ' + industry : ''}`);
    return res.status(200).json({ success: true, keywords: normalized, industry: industry || client.industry });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
