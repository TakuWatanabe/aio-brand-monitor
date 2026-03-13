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
  let mentionCount = 0;
  const details = [];

  for (const query of queries) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: query }],
        max_tokens: 600,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content || '';
      const mentioned = checkMention(response, brandNames);
      if (mentioned) mentionCount++;

      details.push({
        query,
        response: response.substring(0, 300),
        mentioned,
      });

      // API レートリミット対策: 0.5秒待機
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[ChatGPT] クエリエラー: ${err.message}`);
    }
  }

  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  return { score, mentionCount, totalQueries: queries.length, details };
}

/**
 * Perplexity でブランド言及を計測
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details}>}
 */
async function measureWithPerplexity(brandNames, industry) {
  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;
  let mentionCount = 0;
  const details = [];

  for (const query of queries) {
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
      if (mentioned) mentionCount++;

      details.push({
        query,
        response: response.substring(0, 300),
        mentioned,
      });

      // API レートリミット対策: 0.5秒待機
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Perplexity] クエリエラー: ${err.message}`);
    }
  }

  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  return { score, mentionCount, totalQueries: queries.length, details };
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
  let mentionCount = 0;
  const details = [];

  for (const query of queries) {
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
        continue;
      }

      const data = await resp.json();

      // AI Overview フィールドを確認（SerpAPI の ai_overview フィールド）
      let mentioned = false;
      const aiOverview = data.ai_overview;
      if (aiOverview) {
        // ai_overview はテキストまたはオブジェクトの場合がある
        const overviewText = typeof aiOverview === 'string'
          ? aiOverview
          : JSON.stringify(aiOverview);
        mentioned = checkMention(overviewText, brandNames);
      }

      // AI Overview がない場合はオーガニック検索結果の上位もチェック
      if (!mentioned && data.organic_results) {
        const topResults = data.organic_results.slice(0, 3);
        const combinedText = topResults
          .map(r => `${r.title || ''} ${r.snippet || ''}`)
          .join(' ');
        mentioned = checkMention(combinedText, brandNames);
      }

      if (mentioned) mentionCount++;

      details.push({
        query,
        hasAiOverview: !!aiOverview,
        mentioned,
      });

      // レートリミット対策: 0.8秒待機
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`[GoogleAI] クエリエラー: ${err.message}`);
    }
  }

  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  console.log(`[GoogleAI] ${mentionCount}/${queries.length} → ${score}pt`);
  return { score, mentionCount, totalQueries: queries.length, details };
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
  let mentionCount = 0;
  const details = [];

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  for (const query of queries) {
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
        continue;
      }

      const data = await resp.json();
      const response = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const mentioned = checkMention(response, brandNames);
      if (mentioned) mentionCount++;

      details.push({
        query,
        response: response.substring(0, 300),
        mentioned,
      });

      // レートリミット対策: 0.5秒待機
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Gemini] クエリエラー: ${err.message}`);
    }
  }

  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  console.log(`[Gemini] ${mentionCount}/${queries.length} → ${score}pt`);
  return { score, mentionCount, totalQueries: queries.length, details };
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

  const updatedKeywords = [];

  for (const kw of keywords) {
    let mentionCount = 0;
    let totalEngines = 0;

    // ChatGPT でキーワード計測
    if (openai) {
      totalEngines++;
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: kw.kw }],
          max_tokens: 400,
          temperature: 0.7,
        });
        const text = completion.choices[0].message.content || '';
        if (checkMention(text, brandNames)) mentionCount++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`[KW ChatGPT] "${kw.kw}": ${e.message}`);
      }
    }

    // Gemini でキーワード計測
    if (geminiEndpoint) {
      totalEngines++;
      try {
        const resp = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: kw.kw }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (checkMention(text, brandNames)) mentionCount++;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`[KW Gemini] "${kw.kw}": ${e.message}`);
      }
    }

    // presence % を計算
    const newPresence = totalEngines > 0
      ? Math.round((mentionCount / totalEngines) * 100)
      : (kw.presence || 0); // エンジンがない場合は既存値を維持

    // 前回との差分を計算
    const oldPresence = kw.presence || 0;
    const diff = newPresence - oldPresence;
    const change = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : oldPresence === 0 ? '--' : '±0%';

    // ステータスを更新
    const status = newPresence >= 50 ? 'high' : newPresence >= 25 ? 'mid' : 'low';

    console.log(`[KW] "${kw.kw}": ${mentionCount}/${totalEngines} → ${newPresence}% (${change})`);
    updatedKeywords.push({ ...kw, presence: newPresence, change, status });
  }

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
  if (!chatGPTKey) {
    console.warn('[競合計測] OPENAI_API_KEY が未設定のためスキップします');
    return competitors;
  }

  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: chatGPTKey });

  // 業界クエリから上位3件を使用（API節約）
  const allQueries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;
  const queries = allQueries.slice(0, 3);

  const updated = [];

  for (const comp of competitors) {
    // self エントリは自社スコアで更新
    if (comp.self) {
      if (selfScore !== null) {
        const diff = selfScore - (comp.score || 0);
        updated.push({
          ...comp,
          score: selfScore,
          trend: diff >= 0 ? `+${diff}pt` : `${diff}pt`,
          dir: diff >= 0 ? 'up' : 'down',
        });
      } else {
        updated.push(comp);
      }
      continue;
    }

    // 競合ブランド名を配列化（スペース区切りで複数名を許容）
    const compBrandNames = [comp.name];

    let mentionCount = 0;
    let queriedCount = 0;

    for (const query of queries) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: query }],
          max_tokens: 500,
          temperature: 0.7,
        });
        const text = completion.choices[0].message.content || '';
        if (checkMention(text, compBrandNames)) mentionCount++;
        queriedCount++;
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`[競合計測] "${comp.name}" クエリエラー: ${e.message}`);
      }
    }

    const newScore = queriedCount > 0
      ? Math.round((mentionCount / queriedCount) * 100)
      : comp.score || 0;

    const oldScore = comp.score || 0;
    const diff = newScore - oldScore;

    console.log(`[競合計測] ${comp.name}: ${mentionCount}/${queriedCount} → ${newScore}pt (${diff >= 0 ? '+' : ''}${diff}pt)`);

    updated.push({
      ...comp,
      score: newScore,
      trend: diff >= 0 ? `+${diff}pt` : `${diff}pt`,
      dir: diff >= 0 ? 'up' : 'down',
    });
  }

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
