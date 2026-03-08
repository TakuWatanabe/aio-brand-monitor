// lib/supabaseAdmin.js
// Supabase サーバーサイドクライアント（Service Role Key 使用）
// ※ このファイルはサーバー側（API）専用。フロントエンドには公開しないこと

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      // サーバーサイドでは自動トークン更新・セッション永続化は不要
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabase;
