// api/config.js
// GET /api/config
// フロントエンド用の公開設定を返す（Supabase URL / Anon Key）
// 秘密情報は含まない。Vercel 環境変数から読み込む。

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ可

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ error: 'サーバー設定が不完全です (SUPABASE_URL / SUPABASE_ANON_KEY)' });
  }

  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey: supabaseAnon,
  });
};
