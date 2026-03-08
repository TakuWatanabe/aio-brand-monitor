// api/client.js
// GET /api/client
// ログイン中ユーザーのクライアントデータを返すサーバーレス関数（Supabase Auth 版）

const supabase = require("../lib/supabaseAdmin");
const { getClientByEmail } = require("../lib/data");

module.exports = async (req, res) => {
  // CORS ヘッダー（同一オリジンデプロイ時は不要だが開発用に設定）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");

  // プリフライトリクエスト
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET のみ受け付け
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Authorization ヘッダーから Bearer トークンを取得
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization ヘッダーがありません" });
  }

  const accessToken = authHeader.split("Bearer ")[1];

  // Supabase でトークンを検証してユーザー情報を取得
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return res.status(401).json({
      error: "トークンの検証に失敗しました",
      detail: error?.message,
    });
  }

  const email = user.email;

  // メールアドレスからクライアントデータを取得
  const client = getClientByEmail(email);

  if (!client) {
    return res.status(403).json({
      error: "このアカウントに紐づくクライアントデータが見つかりません",
      email,
    });
  }

  return res.status(200).json({ client });
};
