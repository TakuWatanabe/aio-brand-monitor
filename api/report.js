// api/report.js
// GET /api/report
// ログイン中クライアントの月次レポートをPDFで生成・ダウンロード

const supabaseAdmin = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');

// 日本語フォントが必要なため、PDFkitのデフォルトフォントで英数字レイアウトを使用
// 日本語テキストはHTMLエンティティ変換で表示する

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

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

  const { data: client, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('email', user.email)
    .single();
  if (error || !client) return res.status(404).json({ error: 'クライアントが見つかりません' });

  // === PDF生成 ===
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'AIO Brand Monitor Monthly Report' } });
  const buffers = [];
  doc.on('data', chunk => buffers.push(chunk));

  const now = new Date();
  const reportDate = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const score = client.current_score || 0;
  const scoreChange = client.score_change || '±0pt';
  const engines = client.engines || [];
  const keywords = client.keywords || [];
  const competitors = client.competitors || [];

  // --- カラーパレット ---
  const NAVY  = '#1F3864';
  const BLUE  = '#2E75B6';
  const GREEN = '#166534';
  const RED   = '#991B1B';
  const GRAY  = '#6B7280';
  const LIGHT = '#F3F4F6';
  const W = 495; // 使用可能幅

  // ============================================================
  // ページ1: カバー
  // ============================================================
  doc.rect(0, 0, 595, 200).fill(NAVY);
  doc.fill('#FFFFFF').fontSize(28).font('Helvetica-Bold')
     .text('AIO Brand Monitor', 50, 60, { width: W });
  doc.fontSize(16).font('Helvetica')
     .text('Monthly Report', 50, 96, { width: W });
  doc.fontSize(12)
     .text(reportDate + ' Report', 50, 120, { width: W });

  doc.fill(NAVY).fontSize(22).font('Helvetica-Bold')
     .text(client.name || 'Your Brand', 50, 230, { width: W });
  doc.fill(GRAY).fontSize(12).font('Helvetica')
     .text('Industry: ' + (client.industry || 'N/A'), 50, 260);
  doc.text('Generated: ' + now.toLocaleDateString('ja-JP'), 50, 278);

  // スコアボックス
  doc.roundedRect(50, 310, 200, 100, 8).fill(BLUE);
  doc.fill('#FFFFFF').fontSize(13).font('Helvetica').text('AIO Score', 60, 325);
  doc.fontSize(48).font('Helvetica-Bold').text(String(score), 60, 342);
  doc.fontSize(13).font('Helvetica').text('/ 100pt', 130, 365);

  doc.roundedRect(270, 310, 200, 100, 8).fill(score >= 50 ? '#DCFCE7' : score >= 25 ? '#FEF9C3' : '#FEE2E2');
  const changeColor = scoreChange.startsWith('+') ? GREEN : scoreChange.startsWith('-') ? RED : GRAY;
  doc.fill(changeColor).fontSize(13).font('Helvetica').text('vs Last Month', 280, 325);
  doc.fontSize(32).font('Helvetica-Bold').text(scoreChange, 280, 342);
  doc.fill(GRAY).fontSize(11).font('Helvetica').text('Rank: #' + ((() => {
    const sorted = [...competitors].sort((a, b) => b.score - a.score);
    return sorted.findIndex(c => c.self) + 1 || '--';
  })()), 280, 382);

  // フッター
  doc.fill(GRAY).fontSize(9).font('Helvetica')
     .text('Powered by AIO Brand Monitor — BitStar Inc.', 50, 780, { width: W, align: 'center' });

  // ============================================================
  // ページ2: AIエンジン別スコア
  // ============================================================
  doc.addPage();
  doc.fill(NAVY).fontSize(18).font('Helvetica-Bold').text('AI Engine Breakdown', 50, 50);
  doc.moveTo(50, 75).lineTo(545, 75).stroke(LIGHT);

  let y = 90;
  engines.forEach(e => {
    const barW = Math.max(0, Math.min(W - 120, (e.val / 100) * (W - 120)));
    doc.fill(GRAY).fontSize(11).font('Helvetica').text(e.name, 50, y);
    doc.roundedRect(170, y - 2, W - 120, 14, 4).fill('#E5E7EB');
    doc.roundedRect(170, y - 2, barW, 14, 4).fill(e.color || BLUE);
    doc.fill(NAVY).fontSize(11).font('Helvetica-Bold').text(String(e.val) + '%', 500, y);
    y += 28;
  });

  // ============================================================
  // ページ3: キーワードランキング
  // ============================================================
  doc.addPage();
  doc.fill(NAVY).fontSize(18).font('Helvetica-Bold').text('AI Keyword Rankings', 50, 50);
  doc.moveTo(50, 75).lineTo(545, 75).stroke(LIGHT);

  // テーブルヘッダー
  doc.roundedRect(50, 85, W, 22, 3).fill(NAVY);
  doc.fill('#FFFFFF').fontSize(9).font('Helvetica-Bold');
  doc.text('#',   55, 91);
  doc.text('Keyword',           75, 91);
  doc.text('AI Presence',      290, 91);
  doc.text('Change',           370, 91);
  doc.text('Google Rank',      430, 91);
  doc.text('Status',           490, 91);

  y = 107;
  keywords.forEach((kw, i) => {
    const bg = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
    doc.rect(50, y, W, 20).fill(bg);
    doc.fill(GRAY).fontSize(9).font('Helvetica').text(String(i + 1), 55, y + 5);
    doc.fill(NAVY).font('Helvetica-Bold').text((kw.kw || '').slice(0, 28), 75, y + 5);
    const presColor = kw.presence >= 50 ? GREEN : kw.presence >= 25 ? '#854D0E' : RED;
    doc.fill(presColor).text(String(kw.presence || 0) + '%', 290, y + 5);
    const chgColor = (kw.change || '').startsWith('+') ? GREEN : (kw.change || '').startsWith('-') ? RED : GRAY;
    doc.fill(chgColor).text(kw.change || '--', 370, y + 5);
    doc.fill(GRAY).text(kw.gsc_position ? kw.gsc_position + 'i' : kw.serp_position ? kw.serp_position + 'i*' : '-', 430, y + 5);
    const statusLabel = kw.status === 'high' ? 'Strong' : kw.status === 'mid' ? 'Mid' : 'Weak';
    const statusColor = kw.status === 'high' ? GREEN : kw.status === 'mid' ? '#854D0E' : RED;
    doc.fill(statusColor).text(statusLabel, 490, y + 5);
    y += 20;
    if (y > 750) { doc.addPage(); y = 50; }
  });

  // ============================================================
  // ページ4: 競合比較
  // ============================================================
  doc.addPage();
  doc.fill(NAVY).fontSize(18).font('Helvetica-Bold').text('Competitor Analysis', 50, 50);
  doc.moveTo(50, 75).lineTo(545, 75).stroke(LIGHT);

  doc.roundedRect(50, 85, W, 22, 3).fill(NAVY);
  doc.fill('#FFFFFF').fontSize(9).font('Helvetica-Bold');
  doc.text('Rank', 55, 91);
  doc.text('Company', 100, 91);
  doc.text('AIO Score', 340, 91);
  doc.text('Trend', 420, 91);

  const sortedComps = [...competitors].sort((a, b) => b.score - a.score);
  y = 107;
  sortedComps.forEach((c, i) => {
    const bg = c.self ? '#EFF6FF' : i % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
    doc.rect(50, y, W, 22).fill(bg);
    doc.fill(c.self ? BLUE : GRAY).font('Helvetica-Bold').fontSize(10).text('#' + (i + 1), 55, y + 5);
    doc.fill(c.self ? BLUE : NAVY).text((c.name || '').slice(0, 28) + (c.self ? ' (You)' : ''), 100, y + 5);
    const barW = Math.max(0, Math.min(200, (c.score / 100) * 200));
    doc.roundedRect(300, y + 4, 200, 10, 3).fill('#E5E7EB');
    doc.roundedRect(300, y + 4, barW, 10, 3).fill(c.self ? BLUE : '#9CA3AF');
    doc.fill(NAVY).font('Helvetica-Bold').fontSize(10).text(String(c.score || 0) + 'pt', 345, y + 5);
    const trendColor = (c.trend || '').startsWith('+') ? GREEN : (c.trend || '').startsWith('-') ? RED : GRAY;
    doc.fill(trendColor).text(c.trend || '--', 420, y + 5);
    y += 22;
  });

  // ============================================================
  // ページ5: トレンド
  // ============================================================
  doc.addPage();
  doc.fill(NAVY).fontSize(18).font('Helvetica-Bold').text('Score Trend (6 Months)', 50, 50);
  doc.moveTo(50, 75).lineTo(545, 75).stroke(LIGHT);

  const trend = (client.trend || []).slice(-6);
  if (trend.length > 0) {
    const maxScore = Math.max(...trend.map(t => t.score), 1);
    const chartH = 180, chartW = W - 60, chartX = 80, chartY = 260;

    // Y軸
    [0, 25, 50, 75, 100].forEach(v => {
      const lineY = chartY - (v / 100) * chartH;
      doc.moveTo(chartX, lineY).lineTo(chartX + chartW, lineY).stroke('#E5E7EB');
      doc.fill(GRAY).fontSize(8).text(String(v), chartX - 25, lineY - 4);
    });

    // バー
    const bW = (chartW / trend.length) * 0.6;
    trend.forEach((t, i) => {
      const bH = (t.score / 100) * chartH;
      const bX = chartX + i * (chartW / trend.length) + (chartW / trend.length - bW) / 2;
      const bY = chartY - bH;
      doc.roundedRect(bX, bY, bW, bH, 3).fill(BLUE);
      doc.fill(NAVY).fontSize(9).font('Helvetica-Bold').text(String(t.score), bX, bY - 14, { width: bW, align: 'center' });
      doc.fill(GRAY).fontSize(8).font('Helvetica').text(t.month || '', bX, chartY + 6, { width: bW, align: 'center' });
    });
  }

  // ============================================================
  // フッター（全ページ共通はpdfkitでは個別設定）
  // ============================================================
  // 最終ページのフッター
  doc.fill(GRAY).fontSize(9).font('Helvetica')
     .text('AIO Brand Monitor — Confidential — ' + reportDate, 50, 800, { width: W, align: 'center' });

  doc.end();

  await new Promise(resolve => doc.on('end', resolve));
  const pdfBuffer = Buffer.concat(buffers);

  const filename = `AIO_Report_${client.name || 'Brand'}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
};
