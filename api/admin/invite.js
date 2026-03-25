// api/admin/invite.js
// POST /api/admin/invite?id=XX
// 指定クライアントに招待メール（またはパスワードリセットメール）を送信する
// 管理者専用エンドポイント

const supabaseAdmin = require('../../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // === 認証 ===
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: '認証に失敗しました' });

  // === 管理者チェック ===
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }

  // === クライアント取得 ===
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id が必要です' });

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('id, name, email')
    .eq('id', id)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: 'クライアントが見つかりません' });
  }

  const email = client.email;
  const appUrl = process.env.APP_URL || 'https://aio-brand-monitor.vercel.app';

  // === Supabase Auth ユーザーの存在確認 ===
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const existingAuthUser = userList?.users?.find(u => u.email === email);

  let result;

  if (!existingAuthUser) {
    // Auth ユーザーが存在しない → 新規招待
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: appUrl,
    });
    if (inviteError) {
      console.error(`[invite] 招待失敗 (${email}):`, inviteError.message);
      return res.status(500).json({ error: `招待メールの送信に失敗しました: ${inviteError.message}` });
    }
    result = { type: 'invite', message: `招待メールを ${email} に送信しました` };
    console.log(`[invite] 新規招待送信: ${email}`);
  } else {
    // Auth ユーザーが存在する → パスワードリセットリンクを生成してメール送信
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: appUrl },
    });
    if (linkError) {
      console.error(`[invite] リンク生成失敗 (${email}):`, linkError.message);
      return res.status(500).json({ error: `パスワードリセットリンクの生成に失敗しました: ${linkError.message}` });
    }

    // Resend でパスワードリセットメールを送信
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.REPORT_FROM_EMAIL || 'AIO Brand Monitor <noreply@bitstar.tokyo>';

    if (apiKey && linkData?.properties?.action_link) {
      const resetLink = linkData.properties.action_link;
      const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>パスワード再設定</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:28px 40px;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="color:#93c5fd;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">AIO Brand Monitor</div>
      <div style="color:#fff;font-size:22px;font-weight:700;">🔑 パスワードの再設定</div>
    </div>
  </div>
  <div style="max-width:600px;margin:0 auto;padding:24px 20px;">
    <div style="background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
        ${client.name} 様<br><br>
        AIO Brand Monitor のパスワード再設定リンクをお送りします。<br>
        以下のボタンをクリックして新しいパスワードを設定してください。
      </p>
      <div style="text-align:center;">
        <a href="${resetLink}"
           style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;
                  text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
          パスワードを再設定する →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center;">
        このリンクは24時間有効です。心当たりがない場合は無視してください。
      </p>
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:12px;">
      © 2025 BitStar Inc. All rights reserved.
    </div>
  </div>
</body>
</html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `【AIO Brand Monitor】パスワード再設定のご案内 — ${client.name}`,
          html,
        }),
      });
    }

    result = { type: 'reset', message: `パスワード再設定メールを ${email} に送信しました` };
    console.log(`[invite] パスワードリセット送信: ${email}`);
  }

  return res.status(200).json({ success: true, ...result });
};
