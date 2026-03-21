// lib/emailReport.js
// 週次レポートメールの HTML 生成 + Resend API 経由での送信
// 環境変数: RESEND_API_KEY, REPORT_FROM_EMAIL (省略時: report@aio-brand-monitor.com)

/**
 * 週次レポート HTML を生成する
 * @param {object} client - DB クライアントレコード
 * @param {number} overallScore - 今週の総合スコア
 * @param {object} engines - { chatgpt, perplexity, googleAI, gemini } それぞれ { score, mentions, total, skipped }
 * @returns {string} HTML 文字列
 */
function buildReportHtml(client, overallScore, engines) {
  const scoreDiff = overallScore - (client.current_score || 0);
  const diffText = scoreDiff >= 0 ? `+${scoreDiff}pt` : `${scoreDiff}pt`;
  const diffColor = scoreDiff >= 0 ? '#10b981' : '#ef4444';
  const scoreColor = overallScore >= 60 ? '#10b981' : overallScore >= 30 ? '#f59e0b' : '#ef4444';

  // エンジン別スコア行
  const engineRows = [
    { name: 'ChatGPT',           data: engines.chatgpt,    weight: '35%' },
    { name: 'Perplexity',        data: engines.perplexity, weight: '35%' },
    { name: 'Google AI Overview', data: engines.googleAI,  weight: '15%' },
    { name: 'Gemini',            data: engines.gemini,     weight: '15%' },
  ]
    .filter(e => !e.data.skipped)
    .map(e => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:500;">${e.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;color:${e.data.score >= 50 ? '#10b981' : e.data.score >= 20 ? '#f59e0b' : '#64748b'};">${e.data.score}pt</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${e.data.mentions}/${e.data.total}回</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:12px;">${e.weight}</td>
      </tr>`)
    .join('');

  // キーワード上位5件
  const keywords = (client.keywords || []).slice(0, 5);
  const keywordRows = keywords.length > 0
    ? keywords.map(kw => {
        const presencePct = Math.round((kw.presence || 0) * 100);
        const statusColor = kw.status === 'high' ? '#10b981' : kw.status === 'mid' ? '#f59e0b' : '#94a3b8';
        const statusLabel = kw.status === 'high' ? '高' : kw.status === 'mid' ? '中' : '低';
        const googleAiBadge = kw.google_ai === true
          ? '<span style="background:#dbeafe;color:#2563eb;padding:2px 6px;border-radius:4px;font-size:11px;">✓ AI概要</span>'
          : '<span style="background:#f1f5f9;color:#94a3b8;padding:2px 6px;border-radius:4px;font-size:11px;">未掲載</span>';
        return `
          <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;">${kw.kw}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
              <span style="color:${statusColor};font-weight:700;">${presencePct}%</span>
            </td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${googleAiBadge}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${statusColor};font-weight:600;">${statusLabel}</td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;">キーワードデータなし</td></tr>';

  // 競合ランキング上位5件
  const competitors = [...(client.competitors || [])].sort((a, b) => b.score - a.score).slice(0, 5);
  const competitorRows = competitors.length > 0
    ? competitors.map((c, i) => {
        const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`;
        const selfStyle = c.self ? 'background:#eff6ff;font-weight:700;' : '';
        const selfMark = c.self ? ' ← 自社' : '';
        return `
          <tr style="${selfStyle}">
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${rankEmoji}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;">${c.name}${selfMark}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;color:${c.self ? '#2563eb' : '#475569'};">${c.score}pt</td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;">競合データなし</td></tr>';

  const weekStartStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AIOスコア 週次レポート</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:32px 40px;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="color:#93c5fd;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">AIO Brand Monitor</div>
      <div style="color:#fff;font-size:24px;font-weight:700;">週次AIスコアレポート</div>
      <div style="color:#bfdbfe;font-size:14px;margin-top:6px;">${weekStartStr} 計測分</div>
    </div>
  </div>

  <!-- Main -->
  <div style="max-width:600px;margin:0 auto;padding:24px 20px;">

    <!-- クライアント名 + 総合スコア -->
    <div style="background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">
      <div style="color:#64748b;font-size:13px;margin-bottom:4px;">${client.name}</div>
      <div style="display:flex;align-items:baseline;gap:12px;">
        <span style="font-size:56px;font-weight:800;color:${scoreColor};line-height:1;">${overallScore}</span>
        <span style="font-size:22px;color:#94a3b8;font-weight:300;">pt</span>
        <span style="font-size:18px;font-weight:700;color:${diffColor};">${diffText}</span>
      </div>
      <div style="color:#94a3b8;font-size:13px;margin-top:8px;">総合 AIOスコア（4エンジン加重平均）</div>

      <!-- スコアバー -->
      <div style="margin-top:16px;background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;">
        <div style="width:${Math.min(overallScore, 100)}%;height:100%;background:${scoreColor};border-radius:99px;transition:width 0.6s;"></div>
      </div>
    </div>

    <!-- エンジン別スコア -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:16px;">📊 エンジン別スコア</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">エンジン</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">スコア</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">言及数</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">重み</th>
          </tr>
        </thead>
        <tbody>${engineRows}</tbody>
      </table>
    </div>

    <!-- キーワード -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:16px;">🔑 キーワード存在感 TOP5</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">キーワード</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">AI存在感</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">Google AI概要</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">状態</th>
          </tr>
        </thead>
        <tbody>${keywordRows}</tbody>
      </table>
    </div>

    <!-- 競合ランキング -->
    <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:16px;">🏆 競合 AIスコアランキング</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">順位</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">企業名</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;">スコア</th>
          </tr>
        </thead>
        <tbody>${competitorRows}</tbody>
      </table>
    </div>

    <!-- ダッシュボードリンク -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://aio-brand-monitor.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;">
        ダッシュボードを開く →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#94a3b8;font-size:12px;line-height:1.8;">
      <div>このメールは AIO Brand Monitor から自動送信されています。</div>
      <div>© 2025 BitStar Inc. All rights reserved.</div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Resend API 経由でレポートメールを送信する
 * @param {object} params
 * @param {string} params.to - 送信先メールアドレス
 * @param {string} params.clientName - クライアント名（件名に使用）
 * @param {string} params.html - メール本文 HTML
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function sendReportEmail({ to, clientName, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.REPORT_FROM_EMAIL || 'AIO Brand Monitor <report@aio-brand-monitor.com>';

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY が未設定のためスキップします');
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }

  const weekStr = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
  const subject = `【AIO週次レポート】${clientName} — ${weekStr}のAIスコア`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[Email] 送信失敗 (${to}): ${resp.status} ${err}`);
      return { ok: false, error: `${resp.status}: ${err}` };
    }

    const data = await resp.json();
    console.log(`[Email] 送信成功 (${to}): id=${data.id}`);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error(`[Email] 送信エラー (${to}): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { buildReportHtml, sendReportEmail };
