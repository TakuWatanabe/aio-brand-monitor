// api/client.js
// GET /api/client
// ログイン中ユーザーのクライアントデータを Supabase DB から返す

const supabase = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization ヘッダーがありません' });
  }

  const accessToken = authHeader.split('Bearer ')[1];

  // JWT payload を直接デコードしてメールを取得（Supabase Auth API 呼び出し不要）
  let userEmail;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString('utf-8'));
    userEmail = payload.email;
    if (!userEmail) throw new Error('email not found in token');
    // トークンの有効期限チェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'トークンの検証に失敗しました', detail: e.message });
  }

  // Supabase DB からクライアントデータを取得
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('email', userEmail)
    .single();

  if (clientError || !client) {
    return res.status(403).json({
      error: 'このアカウントに紐づくクライアントデータが見つかりません',
      email: userEmail,
    });
  }

  // ダッシュボード用フォーマットに変換
  const dashboardClient = {
    id: client.id,
    email: client.email,
    name: client.name,
    short: client.short,
    color: client.color,
    industry: client.industry,
    userName: client.user_name,
    userRole: client.user_role,
    score: client.current_score,
    scoreChange: client.score_change || '+0',
    rank: client.rank || 1,
    kpi: client.kpi || [],
    trend: client.trend || [],
    engines: client.engines || [],
    keywords: client.keywords || [],
    competitors: client.competitors || [],
    influencers: client.influencers || [],
    barData: client.bar_data || [],
    insight: client.insight || '',
    updatedAt: client.updated_at,
  };

  return res.status(200).json({ client: dashboardClient });
};
