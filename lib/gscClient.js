// lib/gscClient.js
// Google Search Console API クライアント
// - Service Account JSON で JWT 認証（googleapis パッケージ不要）
// - キーワードごとのインプレッション数・クリック数・掲載順位を取得

const crypto = require('crypto');

/**
 * Service Account JSON から Google API アクセストークンを取得（JWT Bearer フロー）
 * @param {object|string} serviceAccountJson - Vercel 環境変数から取得した SA JSON
 * @returns {Promise<string>} - アクセストークン
 */
async function getAccessToken(serviceAccountJson) {
  const sa = typeof serviceAccountJson === 'string'
    ? JSON.parse(serviceAccountJson)
    : serviceAccountJson;

  const now = Math.floor(Date.now() / 1000);

  // JWT ヘッダー・ペイロードを base64url エンコード
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  // JWT を送ってアクセストークンを取得
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`[GSC] トークン取得失敗: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  if (!data.access_token) throw new Error('[GSC] access_token が取得できませんでした');
  return data.access_token;
}

/**
 * GSC Search Analytics からクエリデータを取得
 * @param {string} accessToken
 * @param {string} siteUrl - "https://example.com/" 形式（末尾スラッシュ必須）
 * @param {number} days - 取得する日数（デフォルト28日）
 * @returns {Promise<Array<{query, impressions, clicks, position, ctr}>>}
 */
async function fetchSearchAnalytics(accessToken, siteUrl, days = 28) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 1000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`[GSC] SearchAnalytics API エラー: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return (data.rows || []).map(row => ({
    query: row.keys[0],
    impressions: row.impressions,
    clicks: row.clicks,
    position: Math.round(row.position * 10) / 10,
    ctr: Math.round(row.ctr * 1000) / 10, // % 表記
  }));
}

/**
 * GSC インプレッションデータをキーワード配列にマッピングして月間検索量（vol）を更新
 *
 * 照合ロジック:
 *   1. 完全一致（大文字小文字無視）
 *   2. キーワードが GSC クエリを含む（部分一致）
 *   3. GSC クエリがキーワードを含む（部分一致）
 *   → マッチした行のインプレッション合計を vol として使用
 *
 * @param {Array<{kw, vol, ...}>} keywords
 * @param {string} siteUrl
 * @param {string|object} serviceAccountJson
 * @returns {Promise<Array>} - vol / gsc_impressions / gsc_clicks / gsc_position が更新されたキーワード配列
 */
async function updateKeywordsWithGSC(keywords, siteUrl, serviceAccountJson) {
  if (!serviceAccountJson || !siteUrl) {
    console.warn('[GSC] GSC_SERVICE_ACCOUNT または GSC_SITE_URL が未設定のためスキップします');
    return keywords;
  }

  console.log(`[GSC] ${siteUrl} のSearch Analyticsを取得中...`);

  let rows;
  try {
    const token = await getAccessToken(serviceAccountJson);
    rows = await fetchSearchAnalytics(token, siteUrl);
    console.log(`[GSC] ${rows.length} クエリ行を取得しました`);
  } catch (err) {
    console.error(`[GSC] エラー: ${err.message}`);
    return keywords; // エラー時はスキップして既存データを維持
  }

  return keywords.map(kw => {
    const kwLower = kw.kw.toLowerCase();

    // 照合: 完全一致 → キーワード包含 → クエリ包含 の順で探す
    const matchedRows = rows.filter(row => {
      const qLower = row.query.toLowerCase();
      return qLower === kwLower
        || kwLower.includes(qLower)
        || qLower.includes(kwLower);
    });

    if (matchedRows.length === 0) {
      console.log(`[GSC] "${kw.kw}": GSCデータなし（vol は既存値を維持）`);
      return kw;
    }

    // マッチした行のインプレッション・クリックを合算
    const totalImpressions = matchedRows.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = matchedRows.reduce((s, r) => s + r.clicks, 0);
    const avgPosition = matchedRows.reduce((s, r) => s + r.position, 0) / matchedRows.length;

    const vol = formatImpressions(totalImpressions);
    console.log(`[GSC] "${kw.kw}": ${totalImpressions}インプレッション → ${vol} (${matchedRows.length}クエリ合算)`);

    return {
      ...kw,
      vol,
      gsc_impressions: totalImpressions,
      gsc_clicks: totalClicks,
      gsc_position: Math.round(avgPosition * 10) / 10,
    };
  });
}

/**
 * インプレッション数を「月間X万」形式にフォーマット
 */
function formatImpressions(impressions) {
  if (impressions >= 100000) return `月間${Math.round(impressions / 10000)}万`;
  if (impressions >= 10000)  return `月間${(impressions / 10000).toFixed(1)}万`;
  if (impressions >= 1000)   return `月間${Math.round(impressions / 1000)}千`;
  if (impressions >= 100)    return `月間${Math.round(impressions / 100)}百`;
  return `月間${impressions}`;
}

module.exports = { updateKeywordsWithGSC };
