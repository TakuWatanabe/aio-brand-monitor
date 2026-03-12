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

module.exports = {
  measureWithChatGPT,
  measureWithPerplexity,
  getWeekStart,
  getCurrentMonth,
  INDUSTRY_QUERIES,
};
