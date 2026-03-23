// api/report.js
// GET /api/report
// 月次レポートをHTML形式で生成（ブラウザの印刷→PDF保存で高品質PDF化）
// 日本語フォント: Google Fonts CDN (Noto Sans JP)

const supabaseAdmin = require('../lib/supabaseAdmin');
const { createClient } = require('@supabase/supabase-js');

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

  // === データ準備 ===
  const now = new Date();
  const reportYear  = now.getFullYear();
  const reportMonth = now.getMonth() + 1;
  const reportDate  = `${reportYear}年${reportMonth}月`;
  const score       = client.current_score || 0;
  const scoreChange = client.score_change  || '±0pt';
  const engines     = client.engines  || [];
  const keywords    = client.keywords || [];
  const competitors = [...(client.competitors || [])].sort((a, b) => b.score - a.score);
  const trend       = (client.trend   || []).slice(-6);
  const citations   = client.citations || [];

  const selfRank = (() => {
    const selfIdx = competitors.findIndex(c => c.self);
    return selfIdx >= 0 ? selfIdx + 1 : '--';
  })();

  const scoreColor = score >= 60 ? '#166534' : score >= 30 ? '#92400E' : '#991B1B';
  const scoreBg    = score >= 60 ? '#DCFCE7' : score >= 30 ? '#FEF9C3' : '#FEE2E2';
  const changeIsPlus = scoreChange.startsWith('+');
  const changeColor  = changeIsPlus ? '#166534' : scoreChange.startsWith('-') ? '#991B1B' : '#374151';

  // エンジン棒グラフHTML
  function engineBar(e) {
    const pct = Math.min(100, Math.max(0, e.val || 0));
    return `
      <div class="engine-row">
        <div class="engine-name">${e.name}</div>
        <div class="engine-track">
          <div class="engine-fill" style="width:${pct}%;background:${e.color || '#2E75B6'}"></div>
        </div>
        <div class="engine-pct">${pct}%</div>
      </div>`;
  }

  // 競合行HTML
  function competitorRow(c, i) {
    const col  = c.score >= 60 ? '#166534' : c.score >= 30 ? '#92400E' : '#991B1B';
    const pct  = Math.min(100, c.score || 0);
    const trendColor = (c.trend || '').startsWith('+') ? '#166534' : (c.trend || '').startsWith('-') ? '#991B1B' : '#374151';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    return `
      <tr class="${c.self ? 'self-row' : ''}">
        <td class="medal">${medal}</td>
        <td class="comp-name">${c.name}${c.self ? ' 👈' : ''}</td>
        <td>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${col}"></div>
          </div>
        </td>
        <td class="score-val" style="color:${col}">${c.score}pt</td>
        <td class="trend-val" style="color:${trendColor}">${c.trend || '--'}</td>
      </tr>`;
  }

  // キーワード行HTML
  function keywordRow(kw, i) {
    const presColor = kw.presence >= 50 ? '#166534' : kw.presence >= 25 ? '#92400E' : '#991B1B';
    const pct       = Math.min(100, kw.presence || 0);
    const chgColor  = (kw.change || '').startsWith('+') ? '#166534' : (kw.change || '').startsWith('-') ? '#991B1B' : '#374151';
    const statusLabel = kw.status === 'high' ? '強い' : kw.status === 'mid' ? '改善余地' : '要強化';
    const statusCls   = kw.status === 'high' ? 'tag-high' : kw.status === 'mid' ? 'tag-mid' : 'tag-low';
    const gaikyou     = kw.google_ai === true ? '✓ 掲載中' : kw.google_ai === false ? '✗ 未掲載' : '--';
    const gaikyouCls  = kw.google_ai === true ? 'ai-yes' : kw.google_ai === false ? 'ai-no' : '';
    const pos = kw.gsc_position != null ? `${kw.gsc_position}位`
              : kw.serp_position != null ? `${kw.serp_position}位*`
              : '圏外';
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="kw-name">${kw.kw}</td>
        <td>
          <div class="presence-wrap">
            <div class="bar-track small">
              <div class="bar-fill" style="width:${pct}%;background:#2E75B6"></div>
            </div>
            <span style="color:${presColor};font-weight:700">${pct}%</span>
          </div>
        </td>
        <td style="color:${chgColor};font-weight:600">${kw.change || '--'}</td>
        <td>${pos}</td>
        <td class="${gaikyouCls}">${gaikyou}</td>
        <td><span class="tag ${statusCls}">${statusLabel}</span></td>
      </tr>`;
  }

  // トレンドグラフ (SVG)
  function trendSVG() {
    if (!trend.length) return '<p style="color:#9CA3AF;text-align:center;padding:24px">データがありません</p>';
    const W = 500, H = 160, PL = 40, PR = 10, PT = 15, PB = 30;
    const iW = W - PL - PR, iH = H - PT - PB;
    const maxV = Math.max(...trend.map(t => t.score), 1);
    const bW   = (iW / trend.length) * 0.55;
    const gap  = (iW / trend.length);
    let bars = '', labels = '', vals = '';
    trend.forEach((t, i) => {
      const bH = Math.max(2, (t.score / maxV) * iH);
      const bX = PL + i * gap + (gap - bW) / 2;
      const bY = PT + iH - bH;
      bars   += `<rect x="${bX.toFixed(1)}" y="${bY.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}" rx="3" fill="#2E75B6"/>`;
      labels += `<text x="${(bX + bW / 2).toFixed(1)}" y="${(H - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="#6B7280">${t.month}</text>`;
      vals   += `<text x="${(bX + bW / 2).toFixed(1)}" y="${(bY - 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="bold" fill="#1F3864">${t.score}</text>`;
    });
    const gridLines = [0, 25, 50, 75, 100].map(v => {
      const y = PT + iH - (v / 100) * iH;
      return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#E5E7EB" stroke-width="1"/>
              <text x="${(PL - 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#9CA3AF">${v}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${gridLines}${bars}${labels}${vals}</svg>`;
  }

  // 引用URL
  const topCitations = citations
    .filter(c => (c.urls||[]).some(u => { try { return new URL(u).pathname !== '/'; } catch { return false; } }))
    .slice(0, 6);

  // ============================================================
  // HTML生成
  // ============================================================
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIO Brand Monitor — ${reportDate} レポート — ${client.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
/* ─── 基本 ─── */
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans JP',sans-serif;background:#F0F4FF;color:#1a1a2e;font-size:13px;line-height:1.6}
.page{width:210mm;min-height:297mm;background:#fff;margin:0 auto 16px;padding:12mm 14mm;page-break-after:always;position:relative}
.page:last-child{page-break-after:auto}

/* ─── 印刷ボタン (非印刷) ─── */
.print-bar{background:#1F3864;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.print-bar-title{color:#fff;font-weight:700;font-size:14px}
.print-btn{background:#5DBBF5;color:#1F3864;border:none;padding:8px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.print-btn:hover{background:#93D5F8}
@media print{.print-bar{display:none}body{background:#fff}.page{margin:0;box-shadow:none;page-break-after:always}}

/* ─── カバーページ ─── */
.cover-header{background:linear-gradient(135deg,#1F3864 0%,#2E75B6 60%,#5DBBF5 100%);margin:-12mm -14mm 0;padding:14mm 14mm 10mm;color:#fff}
.cover-logo{font-size:11px;font-weight:700;opacity:.6;margin-bottom:4px;letter-spacing:1px;text-transform:uppercase}
.cover-title{font-size:26px;font-weight:900;margin-bottom:4px}
.cover-sub{font-size:14px;opacity:.75}
.cover-body{padding:10mm 0 0}
.cover-client{font-size:22px;font-weight:900;color:#1F3864;margin-bottom:3px}
.cover-meta{font-size:12px;color:#6B7280;margin-bottom:8mm}
.cover-boxes{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8mm}
.cover-box{border-radius:12px;padding:16px 20px}
.cover-box-label{font-size:11px;font-weight:700;margin-bottom:6px;opacity:.7}
.cover-box-val{font-size:40px;font-weight:900;line-height:1}
.cover-box-unit{font-size:13px;font-weight:400;margin-left:4px;opacity:.7}
.cover-box-sub{font-size:11px;margin-top:4px;opacity:.7}

/* ─── セクションヘッダー ─── */
.sec-head{border-left:4px solid #2E75B6;padding-left:10px;margin-bottom:10mm}
.sec-head h2{font-size:17px;font-weight:900;color:#1F3864}
.sec-head p{font-size:11px;color:#6B7280;margin-top:2px}

/* ─── エンジン ─── */
.engine-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.engine-name{width:140px;font-size:12px;font-weight:500;color:#374151;flex-shrink:0}
.engine-track{flex:1;height:10px;background:#E5E7EB;border-radius:5px;overflow:hidden}
.engine-fill{height:100%;border-radius:5px}
.engine-pct{width:36px;text-align:right;font-weight:700;font-size:12px;color:#1F3864}

/* ─── テーブル共通 ─── */
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#1F3864;color:#fff}
thead th{padding:7px 10px;text-align:left;font-size:11px;font-weight:700}
tbody tr{border-bottom:1px solid #F3F4F6}
tbody tr:hover{background:#F9FAFB}
tbody td{padding:8px 10px;vertical-align:middle}
tbody tr:nth-child(even){background:#F9FAFB}
tbody tr:nth-child(even):hover{background:#EFF6FF}
.self-row td{background:#EFF6FF!important;font-weight:700}

/* ─── 競合 ─── */
.medal{font-size:15px;text-align:center;width:32px}
.comp-name{font-weight:600;color:#1F3864}
.bar-track{width:100px;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;display:inline-block}
.bar-track.small{width:60px}
.bar-fill{height:100%;border-radius:3px}
.score-val{font-weight:700;font-size:13px;width:50px;text-align:right}
.trend-val{font-weight:600;width:50px;text-align:right}

/* ─── キーワード ─── */
.num{color:#9CA3AF;font-size:11px;font-weight:700;width:24px;text-align:center}
.kw-name{font-weight:700;color:#1F3864}
.presence-wrap{display:flex;align-items:center;gap:6px}
.tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
.tag-high{background:#DCFCE7;color:#166534}
.tag-mid{background:#FEF9C3;color:#92400E}
.tag-low{background:#FEE2E2;color:#991B1B}
.ai-yes{color:#166534;font-weight:700}
.ai-no{color:#991B1B}

/* ─── 引用 ─── */
.cite-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cite-card{background:#F9FAFB;border-radius:8px;padding:10px 12px;border:1px solid #E5E7EB}
.cite-domain{font-weight:700;color:#2563EB;font-size:12px;margin-bottom:2px}
.cite-engines{font-size:10px;color:#9CA3AF}
.cite-count{font-size:10px;font-weight:700;color:#1F3864;background:#EBF3FB;padding:1px 6px;border-radius:10px}

/* ─── フッター ─── */
.page-footer{position:absolute;bottom:8mm;left:14mm;right:14mm;border-top:1px solid #E5E7EB;padding-top:5px;display:flex;justify-content:space-between;font-size:9px;color:#9CA3AF}
</style>
</head>
<body>

<!-- 印刷ボタンバー -->
<div class="print-bar">
  <span class="print-bar-title">✦ AIO Brand Monitor — 月次レポート ${reportDate}</span>
  <button class="print-btn" onclick="window.print()">🖨 PDFとして保存 / 印刷</button>
</div>

<!-- ════════════════════════════
     P1: カバー
════════════════════════════ -->
<div class="page">
  <div class="cover-header">
    <div class="cover-logo">AIO Brand Monitor — Powered by BitStar</div>
    <div class="cover-title">月次レポート</div>
    <div class="cover-sub">${reportDate} / AI検索ブランド露出レポート</div>
  </div>
  <div class="cover-body">
    <div class="cover-client">${client.name}</div>
    <div class="cover-meta">
      業種：${client.industry || '未設定'} ／ レポート生成日：${now.getFullYear()}年${reportMonth}月${now.getDate()}日
    </div>
    <div class="cover-boxes">
      <div class="cover-box" style="background:${scoreBg}">
        <div class="cover-box-label" style="color:${scoreColor}">AIOスコア</div>
        <div class="cover-box-val" style="color:${scoreColor}">${score}<span class="cover-box-unit">/ 100pt</span></div>
        <div class="cover-box-sub" style="color:${scoreColor}">総合AI検索露出スコア</div>
      </div>
      <div class="cover-box" style="background:${changeIsPlus ? '#DCFCE7' : '#F3F4F6'}">
        <div class="cover-box-label" style="color:${changeColor}">先月比</div>
        <div class="cover-box-val" style="color:${changeColor}">${scoreChange}</div>
        <div class="cover-box-sub" style="color:${changeColor}">競合内 ${selfRank}位 / ${competitors.length}社</div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>AIエンジン</th><th>スコア貢献</th><th>重み</th><th>ステータス</th>
      </tr></thead>
      <tbody>
        ${engines.map(e => `<tr>
          <td style="font-weight:700">${e.name}</td>
          <td>${e.val}%</td>
          <td style="color:#6B7280;font-size:11px">${
            e.name === 'ChatGPT' ? '30%' :
            e.name === 'Perplexity' ? '30%' :
            e.name === 'Google AI Overview' ? '15%' :
            e.name === 'Claude' ? '15%' :
            e.name === 'Gemini' ? '10%' : '--'
          }</td>
          <td><span class="tag ${e.val >= 50 ? 'tag-high' : e.val >= 20 ? 'tag-mid' : 'tag-low'}">${e.val >= 50 ? '良好' : e.val >= 20 ? '改善余地' : '要強化'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="page-footer">
    <span>AIO Brand Monitor — Confidential</span>
    <span>${client.name} — ${reportDate}</span>
    <span>1 / 5</span>
  </div>
</div>

<!-- ════════════════════════════
     P2: AIエンジン詳細
════════════════════════════ -->
<div class="page">
  <div class="sec-head">
    <h2>📊 AIエンジン別 言及シェア</h2>
    <p>各AIエンジンでの自社ブランド言及率（計測クエリに対する言及割合）</p>
  </div>
  ${engines.length ? engines.map(engineBar).join('') : '<p style="color:#9CA3AF;padding:16px;text-align:center">AIスコア計測を実施するとデータが表示されます</p>'}
  <div style="margin-top:10mm">
    <div class="sec-head" style="margin-bottom:6mm">
      <h2>🏆 競合 AIOスコアランキング</h2>
      <p>同業他社との相対比較（スコア降順）</p>
    </div>
    <table>
      <thead><tr>
        <th style="width:32px"></th><th>企業名</th><th>スコアバー</th>
        <th style="text-align:right">スコア</th><th style="text-align:right">先月比</th>
      </tr></thead>
      <tbody>
        ${competitors.map(competitorRow).join('')}
      </tbody>
    </table>
  </div>
  <div class="page-footer">
    <span>AIO Brand Monitor — Confidential</span>
    <span>${client.name} — ${reportDate}</span>
    <span>2 / 5</span>
  </div>
</div>

<!-- ════════════════════════════
     P3: キーワードランキング
════════════════════════════ -->
<div class="page">
  <div class="sec-head">
    <h2>💬 AIキーワードランキング</h2>
    <p>追跡キーワードごとのAI検索上での存在感と状態</p>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>キーワード</th><th>AI存在感</th>
      <th>前月比</th><th>Google順位</th><th>AI概要</th><th>状態</th>
    </tr></thead>
    <tbody>
      ${keywords.length
        ? keywords.map(keywordRow).join('')
        : '<tr><td colspan="7" style="text-align:center;color:#9CA3AF;padding:24px">キーワードデータがありません</td></tr>'
      }
    </tbody>
  </table>
  <div style="margin-top:4mm;font-size:10px;color:#9CA3AF">
    * はGoogle検索結果のオーガニック順位（SerpAPI）。Google Search Consoleデータがある場合は上書きされます。
  </div>
  <div class="page-footer">
    <span>AIO Brand Monitor — Confidential</span>
    <span>${client.name} — ${reportDate}</span>
    <span>3 / 5</span>
  </div>
</div>

<!-- ════════════════════════════
     P4: AIが引用したURL
════════════════════════════ -->
<div class="page">
  <div class="sec-head">
    <h2>🔗 AIが引用したURLソース</h2>
    <p>ChatGPT・Perplexity・Claude などが自社関連クエリに対して引用したドメイン一覧</p>
  </div>
  ${topCitations.length ? `
  <div class="cite-grid">
    ${topCitations.map(cite => {
      const articleUrls = (cite.urls || []).filter(u => {
        try { return new URL(u).pathname !== '/'; } catch { return false; }
      }).slice(0, 2);
      return `<div class="cite-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div class="cite-domain">${cite.domain}</div>
          <span class="cite-count">${cite.count}回引用</span>
        </div>
        ${articleUrls.map(u => {
          try {
            const path = new URL(u).pathname.replace(/\/$/, '');
            const short = path.length > 40 ? path.slice(0, 38) + '…' : path;
            return `<div style="font-size:10px;color:#6B7280">${short}</div>`;
          } catch { return ''; }
        }).join('')}
        <div class="cite-engines" style="margin-top:4px">${(cite.engines || []).join(' · ')}</div>
      </div>`;
    }).join('')}
  </div>` : '<p style="color:#9CA3AF;text-align:center;padding:24px">計測後に引用URLが表示されます</p>'}

  <div style="margin-top:8mm">
    <div class="sec-head" style="margin-bottom:6mm">
      <h2>💡 AIOスコア改善アドバイス</h2>
      <p>スコアとキーワード状況に基づく自動診断</p>
    </div>
    ${(() => {
      const weakKw  = keywords.filter(k => k.status === 'low').slice(0, 3);
      const noAI    = keywords.filter(k => k.google_ai === false).slice(0, 2);
      const advices = [];
      if (score < 30) {
        advices.push({ icon: '🚨', title: 'AIへの基本情報登録が急務', desc: 'Googleビジネスプロフィール・Wikipedia・業界メディアに基本情報を掲載しましょう。' });
        advices.push({ icon: '📝', title: 'FAQ形式コンテンツを作成', desc: 'AIは「〇〇とは？」などのQ&Aコンテンツを引用しやすい傾向があります。' });
      } else if (score < 60) {
        advices.push({ icon: '📈', title: 'Perplexity対応を強化', desc: '構造化データ（Schema.org）を実装することでPerplexityでの引用率が向上します。' });
        advices.push({ icon: '🔗', title: '権威ある外部メディアへの掲載', desc: '業界専門メディア・比較サイトなど信頼性の高い外部サイトへの言及を増やしましょう。' });
      } else {
        advices.push({ icon: '🎯', title: '弱いキーワードを集中強化', desc: `存在感の低いキーワードに対してコンテンツを作成・充実させましょう。` });
      }
      if (weakKw.length > 0) advices.push({ icon: '⚠️', title: '要強化キーワードへの対応', desc: `「${weakKw.map(k=>k.kw).join('」「')}」のコンテンツ充実が優先課題です。` });
      if (noAI.length > 0) advices.push({ icon: '🔍', title: 'Google AI概要への対応', desc: `「${noAI.map(k=>k.kw).join('」「')}」はGoogle AI概要に未掲載です。E-E-A-T強化が有効です。` });
      advices.push({ icon: '📱', title: 'インフルエンサー施策でAI学習データを増やす', desc: 'BitStarのキャスティング施策でブランド言及を組織的に増やし、AI学習データを強化できます。' });
      return advices.slice(0, 4).map(a => `
        <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6">
          <span style="font-size:18px;flex-shrink:0">${a.icon}</span>
          <div>
            <div style="font-weight:700;font-size:12px;color:#1F3864;margin-bottom:2px">${a.title}</div>
            <div style="font-size:12px;color:#374151">${a.desc}</div>
          </div>
        </div>`).join('');
    })()}
  </div>
  <div class="page-footer">
    <span>AIO Brand Monitor — Confidential</span>
    <span>${client.name} — ${reportDate}</span>
    <span>4 / 5</span>
  </div>
</div>

<!-- ════════════════════════════
     P5: スコアトレンド
════════════════════════════ -->
<div class="page">
  <div class="sec-head">
    <h2>📈 AIOスコア トレンド（直近6ヶ月）</h2>
    <p>月次スコアの推移。ChatGPT・Perplexity・Google AI Overview・Gemini・Claude の合算</p>
  </div>
  ${trendSVG()}
  <div style="margin-top:10mm">
    <div class="sec-head" style="margin-bottom:4mm">
      <h2>📋 サマリー</h2>
    </div>
    <table>
      <tbody>
        <tr><td style="font-weight:700;color:#6B7280;width:160px">レポート対象月</td><td style="font-weight:700">${reportDate}</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">クライアント名</td><td>${client.name}</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">業種</td><td>${client.industry || '未設定'}</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">AIOスコア</td><td style="font-weight:900;color:${scoreColor}">${score}pt / 100pt</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">先月比</td><td style="font-weight:700;color:${changeColor}">${scoreChange}</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">競合内順位</td><td>${selfRank}位 / ${competitors.length}社</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">追跡キーワード数</td><td>${keywords.length}件</td></tr>
        <tr><td style="font-weight:700;color:#6B7280">AI引用ドメイン数</td><td>${citations.length}ドメイン</td></tr>
      </tbody>
    </table>
  </div>
  <div style="margin-top:10mm;background:#1F3864;border-radius:12px;padding:16px 20px;color:#fff">
    <div style="font-weight:700;font-size:13px;margin-bottom:4px">💡 BitStar AIコンサルタントによる提案</div>
    <div style="font-size:12px;opacity:.85;line-height:1.7">
      本レポートの内容をもとに、より詳細な改善プランをご提案できます。インフルエンサーキャスティングを活用したAIスコア向上施策については、担当コンサルタントまでお気軽にお問い合わせください。
    </div>
  </div>
  <div class="page-footer">
    <span>AIO Brand Monitor — Confidential — Powered by BitStar Inc.</span>
    <span>${client.name} — ${reportDate}</span>
    <span>5 / 5</span>
  </div>
</div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};
