// lib/geoReportSection.js
// Phase 5: Creator GEO contribution section for weekly/monthly email reports
//
// Usage in weekly-scores.js:
//   const { buildGeoReportSection } = require('./geoReportSection');
//   const weekStart = '2025-01-06'; const weekEnd = '2025-01-12';
//   const geoSection = await buildGeoReportSection(client.id, weekStart, weekEnd);
//   if (geoSection.hasData) { emailHtml += geoSection.html; emailText += geoSection.text; }

const supabaseAdmin = require('./supabaseAdmin');

/**
 * Builds the GEO creator contribution section for weekly/monthly email reports.
 */
async function buildGeoReportSection(clientId, dateFrom, dateTo) {
  try {
    // 1. Top influencers by GEO score this period
    const { data: geoRows } = await supabaseAdmin
      .from('geo_scores')
      .select(`influencer_id, geo_score, scored_at, cited_by_chatgpt, cited_by_perplexity, cited_by_google_aio, cited_by_gemini, cited_by_claude, influencers ( name, sns_handle, geo_platform, followers, category )`)
      .eq('client_id', clientId).gte('scored_at', dateFrom).lte('scored_at', dateTo).order('geo_score', { ascending: false });

    // Aggregate by influencer (take max score in period)
    const infMap = {};
    for (const row of geoRows || []) {
      const id = row.influencer_id;
      if (!infMap[id] || row.geo_score > infMap[id].geo_score) infMap[id] = row;
    }
    const topInfluencers = Object.values(infMap).sort((a, b) => b.geo_score - a.geo_score).slice(0, 5);

    // 2. Active/completed campaigns this period
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, start_date, end_date, result_baseline_score, result_final_score, result_lift, result_lift_pct')
      .eq('client_id', clientId).lte('start_date', dateTo).gte('end_date', dateFrom);

    // 3. Citation count
    const { count: citationCount } = await supabaseAdmin
      .from('ai_citations').select('*', { count: 'exact', head: true })
      .eq('client_id', clientId).gte('measured_at', dateFrom).lte('measured_at', dateTo);

    if (topInfluencers.length === 0 && (!campaigns || campaigns.length === 0)) {
      return { html: '', text: '', hasData: false };
    }

    const engines = ['chatgpt', 'perplexity', 'google_aio', 'gemini', 'claude'];
    const engineLabels = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', google_aio: 'Google AIO', gemini: 'Gemini', claude: 'Claude' };

    // Build influencer rows
    let infRowsHtml = '';
    let infRowsText = '';
    for (const inf of topInfluencers) {
      const infData = inf.influencers || {};
      const citedEngines = engines.filter(e => inf[`cited_by_${e}`]).map(e => engineLabels[e]);
      const enginesStr = citedEngines.length > 0 ? citedEngines.join(', ') : 'なし';
      const platform = infData.geo_platform ? ` [${infData.geo_platform}]` : '';
      const handle = infData.sns_handle ? ` (@${infData.sns_handle.replace(/^@/, '')})` : '';
      const scoreColor = inf.geo_score >= 50 ? '#16a34a' : inf.geo_score >= 25 ? '#d97706' : '#64748b';
      infRowsHtml += `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-weight:500;">${infData.name || '—'}${platform}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">${enginesStr}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;"><strong style="color:${scoreColor}">${inf.geo_score ?? 0}</strong></td></tr>`;
      infRowsText += `  • ${infData.name || '—'}${handle}${platform}: GEOスコア ${inf.geo_score ?? 0} (${enginesStr})\n`;
    }

    // Build campaign rows
    let campaignHtml = '';
    let campaignText = '';
    for (const c of campaigns || []) {
      if (c.result_lift != null) {
        const sign = c.result_lift >= 0 ? '+' : '';
        const color = c.result_lift > 0 ? '#16a34a' : c.result_lift < 0 ? '#dc2626' : '#64748b';
        campaignHtml += `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${c.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.start_date} 〜 ${c.end_date}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><strong style="color:${color}">${sign}${c.result_lift}pts (${sign}${c.result_lift_pct ?? '?'}%)</strong></td></tr>`;
        campaignText += `  • ${c.name}: AIOスコア ${sign}${c.result_lift}pts (${c.start_date}～${c.end_date})\n`;
      } else {
        campaignHtml += `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${c.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">${c.start_date} 〜 ${c.end_date}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8;">実施中</td></tr>`;
        campaignText += `  • ${c.name}: 実施中 (${c.start_date}～${c.end_date})\n`;
      }
    }

    const html = `<div style="margin-top:32px;border-top:2px solid #e2e8f0;padding-top:24px;"><h2 style="font-size:18px;color:#1e293b;margin:0 0 4px;">📡 GEO クリエイター貢献レポート</h2><p style="font-size:13px;color:#94a3b8;margin:0 0 20px;">${dateFrom} ～ ${dateTo} / AI引用数: ${citationCount ?? 0}件</p>${topInfluencers.length > 0 ? `<h3 style="font-size:14px;color:#475569;margin:0 0 8px;">🏆 AI引用トップクリエイター</h3><table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;"><thead><tr style="background:#f8fafc;"><th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">クリエイター</th><th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">引用AIエンジン</th><th style="text-align:center;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">GEOスコア</th></tr></thead><tbody>${infRowsHtml}</tbody></table>` : ''}${(campaigns||[]).length > 0 ? `<h3 style="font-size:14px;color:#475569;margin:0 0 8px;">📈 キャンペーン AIO効果</h3><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#f8fafc;"><th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">キャンペーン名</th><th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">期間</th><th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:12px;">AIOリフト</th></tr></thead><tbody>${campaignHtml}</tbody></table>` : ''}</div>`;

    const text = `\n╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏\n📡 GEO クリエイター貢献レポート (${dateFrom}～${dateTo})\nAI引用数: ${citationCount ?? 0}件\n\n🏆 AI引用トップクリエイター\n${infRowsText || '  データなし\n'}\n📈 キャンペーン AIO効果\n${campaignText || '  キャンペーンなし\n'}\n╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏╏`;

    return { html, text, hasData: true };
  } catch (err) {
    console.error('[GeoReport] Error:', err.message);
    return { html: '', text: '', hasData: false };
  }
}

module.exports = { buildGeoReportSection };
