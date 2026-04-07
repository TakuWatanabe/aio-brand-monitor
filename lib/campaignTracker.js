// lib/campaignTracker.js
// Phase 3: Campaign lifecycle tracker — called from api/cron/daily-scores.js
//
// Usage in daily-scores.js (add at bottom of handler):
//   const { runCampaignTracker } = require('./campaignTracker');
//   await runCampaignTracker(latestScores);
//
// Where latestScores = { [client_id]: { aio_score, chatgpt_score, perplexity_score } }

const supabaseAdmin = require('./supabaseAdmin');

/**
 * Main entry point — detects campaigns starting or ending today and records campaign_scores.
 */
async function runCampaignTracker(latestScores = {}) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[CampaignTracker] Running for ${today}`);
  try {
    // 1. Campaigns STARTING today → record baseline score
    const { data: startingCampaigns } = await supabaseAdmin.from('campaigns')
      .select('id, name, client_id, start_date, end_date, target_score').eq('start_date', today);
    for (const campaign of startingCampaigns || []) {
      await recordCampaignScore(campaign, today, 'baseline', latestScores);
      console.log(`[CampaignTracker] Baseline recorded: ${campaign.name}`);
    }
    // 2. Campaigns ENDING today → record final score + compute lift
    const { data: endingCampaigns } = await supabaseAdmin.from('campaigns')
      .select('id, name, client_id, start_date, end_date, target_score').eq('end_date', today);
    for (const campaign of endingCampaigns || []) {
      await recordCampaignScore(campaign, today, 'final', latestScores);
      await computeAndStoreLift(campaign);
      console.log(`[CampaignTracker] Final + lift computed: ${campaign.name}`);
    }
    // 3. ACTIVE campaigns → record daily AIO score for trend tracking
    const { data: activeCampaigns } = await supabaseAdmin.from('campaigns')
      .select('id, name, client_id, start_date, end_date, target_score')
      .lt('start_date', today).gt('end_date', today);
    for (const campaign of activeCampaigns || []) {
      const { data: existing } = await supabaseAdmin.from('campaign_scores').select('id')
        .eq('campaign_id', campaign.id).eq('measured_at', today).limit(1);
      if (!existing || existing.length === 0) await recordCampaignScore(campaign, today, 'daily', latestScores);
    }
    console.log(`[CampaignTracker] Done. Starting:${startingCampaigns?.length||0} Ending:${endingCampaigns?.length||0} Active:${activeCampaigns?.length||0}`);
  } catch (err) {
    console.error('[CampaignTracker] Error:', err.message);
    // Non-fatal — don't throw
  }
}

async function recordCampaignScore(campaign, date, scoreType, latestScores) {
  const s = latestScores[campaign.client_id] || {};
  const { error } = await supabaseAdmin.from('campaign_scores').upsert({
    campaign_id: campaign.id, measured_at: date, score_type: scoreType,
    aio_score: s.aio_score ?? null, chatgpt_score: s.chatgpt_score ?? null,
    perplexity_score: s.perplexity_score ?? null, google_aio_score: s.google_aio_score ?? null,
    gemini_score: s.gemini_score ?? null, claude_score: s.claude_score ?? null,
    citation_count: s.citation_count ?? null,
  }, { onConflict: 'campaign_id,measured_at' });
  if (error) console.error('[CampaignTracker] upsert error:', error.message);
}

async function computeAndStoreLift(campaign) {
  const { data: baselineRows } = await supabaseAdmin.from('campaign_scores')
    .select('aio_score').eq('campaign_id', campaign.id).eq('score_type', 'baseline')
    .order('measured_at', { ascending: true }).limit(1);
  const { data: finalRows } = await supabaseAdmin.from('campaign_scores')
    .select('aio_score').eq('campaign_id', campaign.id).eq('score_type', 'final')
    .order('measured_at', { ascending: false }).limit(1);
  const baselineScore = baselineRows?.[0]?.aio_score;
  const finalScore = finalRows?.[0]?.aio_score;
  if (baselineScore == null || finalScore == null) {
    console.warn(`[CampaignTracker] Cannot compute lift for ${campaign.name}`);
    return;
  }
  const lift = finalScore - baselineScore;
  const liftPct = baselineScore > 0 ? Math.round((lift / baselineScore) * 100) : null;
  const { error } = await supabaseAdmin.from('campaigns').update({
    result_baseline_score: baselineScore, result_final_score: finalScore,
    result_lift: lift, result_lift_pct: liftPct, result_recorded_at: new Date().toISOString(),
  }).eq('id', campaign.id);
  if (error) console.error('[CampaignTracker] lift update error:', error.message);
  else console.log(`[CampaignTracker] Lift "${campaign.name}": ${baselineScore}→${finalScore} (+${lift}pts, ${liftPct}%)`);
}

module.exports = { runCampaignTracker };
