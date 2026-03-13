// lib/aiMeasurement.js
// ChatGPT と Perplexity にクエリを送り、ブランド名の登場頻度を計測する

// ============================================================
// 業界別クエリテンプレート
// ============================================================
const INDUSTRY_QUERIES = {
  '化粧品・スキンケア': [
    'おすすめのスキンケアブランドを教えてください',
    '日本の人気化粧品メーカーはどこですか？',
    '敏感肌向けのおすすめコスメブランドは？',
    '美白化粧品で有名なブランドを教えてください',
    '日本発の化粧品ブランドを教えてください',
    'デパートコスメでおすすめのブランドは何ですか？',
    'スキンケアに力を入れているブランドはどこですか？',
    '日本のコスメブランドランキングを教えてください',
  ],
  'ファッション・アパレル': [
    '日本のおすすめファッションブランドを教えてください',
    'プチプラでおすすめのアパレルブランドは？',
    'コスパの良い日本のファッションブランドを教えてください',
    '日本のカジュアルウェアブランドで人気なのは？',
    '日本発のグローバルアパレルブランドを教えてください',
    '秋冬ファッションにおすすめのブランドは何ですか？',
    'メンズファッションにおすすめのブランドは？',
    'レディースファッションで人気の日本ブランドは？',
  ],
  '食品・調味料': [
    '日本の有名な食品メーカーを教えてください',
    'おすすめの調味料ブランドは何ですか？',
    '健康的な食品を作っているメーカーはどこですか？',
    'グルタミン酸や旨味成分で有名なブランドは？',
    '家庭料理に欠かせない食品メーカーを教えてください',
    '日本の老舗食品ブランドを教えてください',
    'レシピに使う定番調味料ブランドは？',
    '日本の代表的な調味料メーカーを教えてください',
  ],
  'インフルエンサーマーケティング': [
    'インフルエンサーマーケティングでおすすめの会社はどこですか？',
    '日本のインフルエンサー事務所・エージェンシーを教えてください',
    'SNSマーケティングに強い日本の会社はどこですか？',
    'YouTuber・TikTokerのマネジメント会社でおすすめはどこですか？',
    'インフルエンサーを使ったプロモーションを得意とする会社は？',
    '日本でインフルエンサーキャスティングを依頼できる会社を教えてください',
    'SNS運用やインフルエンサー活用を支援する企業はどこですか？',
    'ブランドのSNSマーケティング戦略を支援できる会社は？',
  ],
};

// デフォルト（業界が不明な場合）
const DEFAULT_QUERIES = INDUSTRY_QUERIES['食品・調味料'];

// ============================================================
// 競合計測専用クエリ（一覧・網羅系）
// 「おすすめ」系より「全部教えて」系の方が網羅的な社名リストが返る
// ============================================================
const COMPETITOR_LISTING_QUERIES = {
  'インフルエンサーマーケティング': [
    '日本のインフルエンサーマーケティング会社を10社以上リストアップしてください',
    '日本のインフルエンサーエージェンシーを網羅的に教えてください',
    'インフルエンサーマーケティング業界の主要プレイヤーをすべて教えてください',
    '日本でインフルエンサーマーケティングを手掛ける会社の一覧を教えてください',
    'AnyMind、サイバーバズ、トレンダーズ、Natee、Grove、BitStarなど日本のインフルエンサーマーケティング会社について教えてください',
  ],
  '化粧品・スキンケア': [
    '日本の化粧品・コスメブランドを20社以上リストアップしてください',
    '日本のスキンケアブランドを網羅的に教えてください',
    '日本の化粧品メーカー一覧を教えてください',
  ],
  'ファッション・アパレル': [
    '日本のファッション・アパレルブランドを20社以上リストアップしてください',
    '日本のアパレルブランドを網羅的に教えてください',
    '日本のファッションブランド一覧を教えてください',
  ],
  '食品・調味料': [
    '日本の食品メーカーを20社以上リストアップしてください',
    '日本の調味料・食品ブランドを網羅的に教えてください',
    '日本の食品会社一覧を教えてください',
  ],
};

/**
 * テキスト中にブランド名が含まれているか確認
 * @param {string} text
 * @param {string[]} brandNames - 検索するブランド名の配列 (例: ['コーセー', 'KOSÉ'])
 * @returns {boolean}
 */
function checkMention(text, brandNames) {
  const lowerText = text.toLowerCase(); return brandNames.some(name => lowerText.includes(name.toLowerCase()));
}

/**
 * ChatGPT でブランド言及を計測
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details}>}
 */
async function measureWithChatGPT(brandNames, industry) {
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;

  // 全クエリを並列実行（Promise.all）
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: query }],
        max_tokens: 600,
        temperature: 0.7,
      });
      const response = completion.choices[0].message.content || '';
      const mentioned = checkMention(response, brandNames);
      return { query, response: response.substring(0, 300), mentioned };
    } catch (err) {
      console.error(`[ChatGPT] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  return { score, mentionCount, totalQueries: queries.length, details: results };
}

/**
 * Perplexity でブランド言及を計測
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details}>}
 */
async function measureWithPerplexity(brandNames, industry) {
  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;

  // 全クエリを並列実行（Promise.all）
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: query }],
          max_tokens: 600,
        }),
      });
      const data = await resp.json();
      const response = data.choices?.[0]?.message?.content || '';
      const mentioned = checkMention(response, brandNames);
      return { query, response: response.substring(0, 300), mentioned };
    } catch (err) {
      console.error(`[Perplexity] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  return { score, mentionCount, totalQueries: queries.length, details: results };
}

/**
 * 今週の月曜日の日付を返す (YYYY-MM-DD)
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

/**
 * 月名を返す (例: "3月")
 */
function getCurrentMonth() {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return months[new Date().getMonth()];
}

/**
 * Google AI Overview でブランド言及を計測（SerpAPI 使用）
 * SerpAPI 無料プラン: 100クエリ/月
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details}>}
 */
async function measureWithGoogleAI(brandNames, industry) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('[GoogleAI] SERPAPI_KEY が未設定のためスキップします');
    return { score: 0, mentionCount: 0, totalQueries: 0, details: [], skipped: true };
  }

  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;

  // 全クエリを並列実行（Promise.all）
  // SerpAPIは無料枠100件/月のため並列でも問題なし
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', query);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('gl', 'jp');
      url.searchParams.set('hl', 'ja');
      url.searchParams.set('num', '5');

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        console.error(`[GoogleAI] APIエラー: ${resp.status} ${resp.statusText}`);
        return { query, hasAiOverview: false, mentioned: false };
      }

      const data = await resp.json();

      let mentioned = false;
      const aiOverview = data.ai_overview;
      if (aiOverview) {
        const overviewText = typeof aiOverview === 'string'
          ? aiOverview
          : JSON.stringify(aiOverview);
        mentioned = checkMention(overviewText, brandNames);
      }

      if (!mentioned && data.organic_results) {
        const combinedText = data.organic_results.slice(0, 3)
          .map(r => `${r.title || ''} ${r.snippet || ''}`)
          .join(' ');
        mentioned = checkMention(combinedText, brandNames);
      }

      return { query, hasAiOverview: !!aiOverview, mentioned };
    } catch (err) {
      console.error(`[GoogleAI] クエリエラー: ${err.message}`);
      return { query, hasAiOverview: false, mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  console.log(`[GoogleAI] ${mentionCount}/${queries.length} → ${score}pt`);
  return { score, mentionCount, totalQueries: queries.length, details: results };
}

/**
 * Gemini (Google AI Studio) でブランド言及を計測
 * 無料枠: Gemini 1.5 Flash → 1,500リクエスト/日
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details}>}
 */
async function measureWithGemini(brandNames, industry) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY が未設定のためスキップします');
    return { score: 0, mentionCount: 0, totalQueries: 0, details: [], skipped: true };
  }

  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  // 全クエリを並列実行（Promise.all）
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[Gemini] APIエラー: ${resp.status} - ${errText}`);
        return { query, response: '', mentioned: false };
      }

      const data = await resp.json();
      const response = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const mentioned = checkMention(response, brandNames);
      return { query, response: response.substring(0, 300), mentioned };
    } catch (err) {
      console.error(`[Gemini] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  console.log(`[Gemini] ${mentionCount}/${queries.length} → ${score}pt`);
  return { score, mentionCount, totalQueries: queries.length, details: results };
}

/**
 * キーワードごとの AI 上の存在感（presence %）を自動計測・更新
 * ChatGPT + Gemini にキーワードで質問し、ブランド言及率を計算する
 * 例: 「インフルエンサーマーケティング」→ 2エンジン中1つが言及 → presence = 50%
 *
 * @param {Array<{kw, vol, presence, change, status}>} keywords - 現在のキーワード配列
 * @param {string[]} brandNames - チェックするブランド名
 * @returns {Promise<Array>} - presence/change/status が更新されたキーワード配列
 */
async function measureKeywordPresences(keywords, brandNames) {
  const chatGPTKey = process.env.OPENAI_API_KEY;
  const geminiKey  = process.env.GEMINI_API_KEY;

  if (!chatGPTKey && !geminiKey) {
    console.warn('[KW] APIキーが未設定のためキーワード計測をスキップします');
    return keywords;
  }

  const { OpenAI } = require('openai');
  const openai = chatGPTKey ? new OpenAI({ apiKey: chatGPTKey }) : null;
  const geminiEndpoint = geminiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
    : null;

  // 全キーワードを並列処理（Promise.all）
  const updatedKeywords = await Promise.all(keywords.map(async (kw) => {
    const engines = [];

    // ChatGPT と Gemini を同時並列で実行
    if (openai) {
      engines.push(
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: kw.kw }],
          max_tokens: 400,
          temperature: 0.7,
        }).then(c => checkMention(c.choices[0].message.content || '', brandNames))
          .catch(e => { console.error(`[KW ChatGPT] "${kw.kw}": ${e.message}`); return false; })
      );
    }

    if (geminiEndpoint) {
      engines.push(
        fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: kw.kw }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        }).then(async r => {
          if (!r.ok) return false;
          const d = await r.json();
          return checkMention(d.candidates?.[0]?.content?.parts?.[0]?.text || '', brandNames);
        }).catch(e => { console.error(`[KW Gemini] "${kw.kw}": ${e.message}`); return false; })
      );
    }

    const engineResults = await Promise.all(engines);
    const mentionCount  = engineResults.filter(Boolean).length;
    const totalEngines  = engineResults.length;

    const newPresence = totalEngines > 0
      ? Math.round((mentionCount / totalEngines) * 100)
      : (kw.presence || 0);

    const oldPresence = kw.presence || 0;
    const diff = newPresence - oldPresence;
    const change = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : oldPresence === 0 ? '--' : '±0%';
    const status = newPresence >= 50 ? 'high' : newPresence >= 25 ? 'mid' : 'low';

    console.log(`[KW] "${kw.kw}": ${mentionCount}/${totalEngines} → ${newPresence}% (${change})`);
    return { ...kw, presence: newPresence, change, status };
  }));

  return updatedKeywords;
}

/**
 * 競合他社のAIOスコアを自動計測・更新
 * ChatGPT を使って各競合のブランド言及率を計算する（API節約のため3クエリ）
 *
 * @param {Array<{name, score, trend, dir, color, self}>} competitors - 現在の競合配列
 * @param {string} industry - 業界名
 * @param {number} selfScore - 自社の最新スコア（self:true エントリを更新するため）
 * @returns {Promise<Array>} - score/trend/dir が更新された競合配列
 */
async function measureCompetitors(competitors, industry, selfScore = null) {
  const chatGPTKey = process.env.OPENAI_API_KEY;
  const geminiKey  = process.env.GEMINI_API_KEY;

  if (!chatGPTKey && !geminiKey) {
    console.warn('[競合計測] APIキーが未設定のためスキップします');
    return competitors;
  }

  const { OpenAI } = require('openai');
  const openai = chatGPTKey ? new OpenAI({ apiKey: chatGPTKey }) : null;
  const geminiEndpoint = geminiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
    : null;

  // 競合計測専用クエリ（一覧・網羅系）＋ 通常クエリを組み合わせる
  // 一覧系クエリの方が細かい会社名まで列挙してくれる
  const listingQueries = COMPETITOR_LISTING_QUERIES[industry] || [];
  const generalQueries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;
  const queries = [...listingQueries, ...generalQueries];

  // 全競合社を並列処理（Promise.all）
  const updated = await Promise.all(competitors.map(async (comp) => {
    // self エントリは自社スコアで更新（API呼び出し不要）
    if (comp.self) {
      if (selfScore !== null) {
        const diff = selfScore - (comp.score || 0);
        return {
          ...comp,
          score: selfScore,
          trend: diff >= 0 ? `+${diff}pt` : `${diff}pt`,
          dir: diff >= 0 ? 'up' : 'down',
        };
      }
      return comp;
    }

    // names 配列があればそれを使用、なければ name のみ（表記ゆれ対策）
    const compBrandNames = comp.names && comp.names.length > 0 ? comp.names : [comp.name];

    // ChatGPT の全8クエリを並列実行
    const chatGPTPromises = openai
      ? queries.map(query =>
          openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: query }],
            max_tokens: 500,
            temperature: 0.7,
          })
          .then(c => checkMention(c.choices[0].message.content || '', compBrandNames))
          .catch(e => { console.error(`[競合ChatGPT] "${comp.name}": ${e.message}`); return null; })
        )
      : [];

    // Gemini の全8クエリを並列実行
    const geminiPromises = geminiEndpoint
      ? queries.map(query =>
          fetch(geminiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: query }] }],
              generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
            }),
          })
          .then(async r => {
            if (!r.ok) return null;
            const d = await r.json();
            return checkMention(d.candidates?.[0]?.content?.parts?.[0]?.text || '', compBrandNames);
          })
          .catch(e => { console.error(`[競合Gemini] "${comp.name}": ${e.message}`); return null; })
        )
      : [];

    // ChatGPT + Gemini の全結果を同時に待つ
    const allResults = await Promise.all([...chatGPTPromises, ...geminiPromises]);
    const validResults = allResults.filter(r => r !== null);
    const mentionCount = validResults.filter(Boolean).length;
    const queriedCount = validResults.length;

    const newScore = queriedCount > 0
      ? Math.round((mentionCount / queriedCount) * 100)
      : comp.score || 0;

    const oldScore = comp.score || 0;
    const diff = newScore - oldScore;

    console.log(`[競合計測] ${comp.name}: ${mentionCount}/${queriedCount} → ${newScore}pt (${diff >= 0 ? '+' : ''}${diff}pt)`);

    return {
      ...comp,
      score: newScore,
      trend: diff >= 0 ? `+${diff}pt` : `${diff}pt`,
      dir: diff >= 0 ? 'up' : 'down',
    };
  }));

  return updated;
}

module.exports = {
  measureWithChatGPT,
  measureWithPerplexity,
  measureWithGoogleAI,
  measureWithGemini,
  measureKeywordPresences,
  measureCompetitors,
  getWeekStart,
  getCurrentMonth,
  INDUSTRY_QUERIES,
};
