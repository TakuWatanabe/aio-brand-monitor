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

  // ANON_KEY を使ってユーザーのトークンを検証（SERVICE_ROLE_KEY では検証できない場合の対策）
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return res.status(401).json({
      error: 'トークンの検証に失敗しました',
      detail: error?.message,
    });
  }

  // Supabase DB からクライアントデータを取得
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('email', user.email)
    .single();

  if (clientError || !client) {
    return res.status(403).json({
      error: 'このアカウントに紐づくクライアントデータが見つかりません',
      email: user.email,
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
