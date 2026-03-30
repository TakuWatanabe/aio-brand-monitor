checkMention
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
  '採用・HR': [
    '日本のおすすめ採用支援・人材紹介会社はどこですか？',
    '新卒採用に強い採用エージェンシーを教えてください',
    '中途採用を得意とする人材会社はどこですか？',
    '採用ブランディングを支援できる会社はどこですか？',
    '求人メディア・採用プラットフォームでおすすめはどれですか？',
    '採用コンサルティングに強い会社を教えてください',
    'HRテック・採用DXを推進している会社はどこですか？',
    'エンジニア採用が得意な採用支援会社を教えてください',
  ],
  'EC・通販': [
    '日本のECコンサルティング・EC支援会社でおすすめはどこですか？',
    'Amazon・楽天などモール運用を得意とする会社を教えてください',
    'D2C・自社EC構築を支援できる会社はどこですか？',
    'ECサイトのSEO・広告運用を得意とする会社は？',
    '日本の通販・EC業界で有名な会社を教えてください',
    'ECの物流・フルフィルメントを支援する会社はどこですか？',
    'ネットショップ運営代行でおすすめの会社は？',
    'D2Cブランドの立ち上げを支援できる会社を教えてください',
  ],
  '不動産': [
    '日本の不動産会社でおすすめはどこですか？',
    '賃貸物件を探すなら不動産会社はどこがいいですか？',
    '不動産投資を始めるにあたりおすすめの会社は？',
    '新築マンションを購入するなら不動産会社はどこですか？',
    '不動産売却を得意とする会社を教えてください',
    '不動産テック・プロップテック企業でおすすめはどこですか？',
    '商業不動産・オフィス移転を支援できる会社は？',
    '不動産管理を任せられる会社を教えてください',
  ],
  '飲食・外食': [
    '日本で人気の飲食チェーンはどこですか？',
    'フランチャイズで飲食店を始めるならどの会社がおすすめですか？',
    '飲食店の開業・出店支援を得意とする会社はどこですか？',
    '飲食業向けDX・POSシステムでおすすめはどれですか？',
    '外食産業でデリバリーに強い会社を教えてください',
    '飲食店コンサルティングでおすすめの会社はどこですか？',
    '居酒屋・カフェチェーンで有名な会社を教えてください',
    '飲食業の人材派遣・採用支援が得意な会社は？',
  ],
  'SaaS・IT': [
    '日本のSaaS企業でおすすめのツールはどれですか？',
    '中小企業向けのおすすめSaaSサービスを教えてください',
    'マーケティングオートメーションで有名な会社はどこですか？',
    'CRM・SFA系のSaaSでおすすめはどれですか？',
    '日本のIT企業でクラウドサービスが強い会社は？',
    'BtoB SaaSで成長している日本の企業を教えてください',
    '業務効率化・DXを支援するSaaS会社はどこですか？',
    'スタートアップ向けのSaaS・ITツールでおすすめは？',
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
  '採用・HR': [
    '日本の採用支援・人材紹介会社を10社以上リストアップしてください',
    '日本のHRテック・採用DX企業を網羅的に教えてください',
    '日本の人材紹介・採用エージェンシー一覧を教えてください',
  ],
  'EC・通販': [
    '日本のECコンサルティング・EC支援会社を10社以上リストアップしてください',
    '日本のEC・通販支援企業を網羅的に教えてください',
    'Amazonや楽天のモール運用代行会社一覧を教えてください',
  ],
  '不動産': [
    '日本の不動産会社を20社以上リストアップしてください',
    '日本の不動産テック企業を網羅的に教えてください',
    '日本の不動産管理・仲介会社一覧を教えてください',
  ],
  '飲食・外食': [
    '日本の飲食チェーン・外食企業を20社以上リストアップしてください',
    '日本の飲食コンサルティング会社を網羅的に教えてください',
    '飲食フランチャイズ企業の一覧を教えてください',
  ],
  'SaaS・IT': [
    '日本のSaaS企業を20社以上リストアップしてください',
    '日本のBtoB SaaS・クラウドサービス会社を網羅的に教えてください',
    '日本のITスタートアップ・SaaS企業一覧を教えてください',
  ],
};

/**
 * テキスト中にブランド名が含まれているか確認
 * @param {string} text
 * @param {string[]} brandNames - 検索するブランド名の配列 (例: ['コーセー', 'KOSÉ'])
 * @returns {boolean}
 */
function checkMention(text, brandNames) {
  return brandNames.some(name => {
    if (/^[a-zA-Z0-9\s]+$/.test(name) && name.trim().length <= 10) {
      const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i').test(text);
    }
    return text.toLowerCase().includes(name.toLowerCase());
  });
}
/**
 * テキストから URL を抽出する（AIレスポンス引用URL検出用）
 * @param {string} text
 * @returns {string[]}
 */
function extractUrlsFromText(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'\)\]、。！？]+/g;
  return [...new Set(
    (text.match(urlRegex) || [])
      .map(url => url.replace(/[.,;:\)\]]+$/, ''))
      .filter(url => url.length > 12 && url.includes('.'))
  )];
}

/**
 * ブランド言及箇所のセンチメントを判定（ポジ/ネガ/中立）
 * @param {string} text - AI レスポンス全文
 * @param {string[]} brandNames - ブランド名配列
 * @returns {'positive'|'negative'|'neutral'}
 */
function analyzeSentiment(text, brandNames) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  let context = '';
  for (const name of brandNames) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx !== -1) {
      context += text.slice(Math.max(0, idx - 100), Math.min(text.length, idx + 200)) + ' ';
    }
  }
  if (!context) context = text;

  const positiveWords = [
    'おすすめ', '優れ', '実績', '信頼', '定評', '人気', '強み', '得意',
    '充実', '豊富', '高品質', '安心', '効果的', 'トップ', '大手', '専門性',
    '評判', '支持', 'No.1', '1位', '最大', '業界最大', '業界トップ',
  ];
  const negativeWords = [
    '問題', '批判', '懸念', '不満', '悪い', '低い', '弱い', '課題',
    '難しい', 'リスク', '失敗', '炎上', '疑問', '不安', '劣る',
  ];

  let pos = 0, neg = 0;
  positiveWords.forEach(w => { if (context.includes(w)) pos++; });
  negativeWords.forEach(w => { if (context.includes(w)) neg++; });

  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

/**
 * URL 群からドメイン別集計を返す（上位10件）
 * @param {string[]} urls
 * @returns {Array<{domain: string, count: number, urls: string[]}>}
 */
function aggregateCitationsByDomain(urls) {
  const map = {};
  urls.forEach(url => {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      if (!map[domain]) map[domain] = { domain, count: 0, urls: [] };
      map[domain].count++;
      if (map[domain].urls.length < 3) map[domain].urls.push(url);
    } catch {}
  });
  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
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
        messages: [
          { role: 'system', content: '回答の最後に「参考URL:」として参照したウェブサイトのURLをリストアップしてください（例: https://example.com）。' },
          { role: 'user', content: query },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      const response = completion.choices[0].message.content || '';
      const mentioned = checkMention(response, brandNames);
      const citations = extractUrlsFromText(response);
      const sentiment = mentioned ? analyzeSentiment(response, brandNames) : null;
      return { query, response, mentioned, citations, sentiment };
    } catch (err) {
      console.error(`[ChatGPT] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  // センチメント集計
  const mentionedResults = results.filter(r => r.mentioned);
  const sentimentSummary = {
    positive: mentionedResults.filter(r => r.sentiment === 'positive').length,
    negative: mentionedResults.filter(r => r.sentiment === 'negative').length,
    neutral:  mentionedResults.filter(r => r.sentiment === 'neutral').length,
  };

  const allChatGPTCitations = results.flatMap(r => r.citations || []);
  return { score, mentionCount, totalQueries: queries.length, details: results, citations: allChatGPTCitations, sentiment: sentimentSummary };
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
      const perplexityCitations = data.citations || [];
      const textCitations = extractUrlsFromText(response);
      const citations = [...new Set([...perplexityCitations, ...textCitations])];
      const mentioned = checkMention(response, brandNames);
      const sentiment = mentioned ? analyzeSentiment(response, brandNames) : null;
      return { query, response, mentioned, citations, sentiment };
    } catch (err) {
      console.error(`[Perplexity] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  const mentionedResults = results.filter(r => r.mentioned);
  const sentimentSummary = {
    positive: mentionedResults.filter(r => r.sentiment === 'positive').length,
    negative: mentionedResults.filter(r => r.sentiment === 'negative').length,
    neutral:  mentionedResults.filter(r => r.sentiment === 'neutral').length,
  };

  const allPerplexityCitations = results.flatMap(r => r.citations || []);
  return { score, mentionCount, totalQueries: queries.length, details: results, citations: allPerplexityCitations, sentiment: sentimentSummary };
}

/**
 * Claude (Anthropic) でブランド言及を計測
 * 無料枠なし（従量課金）: claude-haiku が最安
 * @param {string[]} brandNames
 * @param {string} industry
 * @returns {Promise<{score, mentionCount, totalQueries, details, citations}>}
 */
async function measureWithClaude(brandNames, industry) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Claude] ANTHROPIC_API_KEY が未設定のためスキップします');
    return { score: 0, mentionCount: 0, totalQueries: 0, details: [], skipped: true };
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const queries = INDUSTRY_QUERIES[industry] || DEFAULT_QUERIES;

  const results = await Promise.all(queries.map(async (query) => {
    try {
      const message = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 700,
        system: '回答の最後に「参考URL:」として参照したウェブサイトのURLをリストアップしてください（例: https://example.com）。',
        messages: [{ role: 'user', content: query }],
      });
      const response = message.content[0]?.text || '';
      const mentioned = checkMention(response, brandNames);
      const citations = extractUrlsFromText(response);
      const sentiment = mentioned ? analyzeSentiment(response, brandNames) : null;
      return { query, response, mentioned, citations, sentiment };
    } catch (err) {
      console.error(`[Claude] クエリエラー: ${err.message}`);
      return { query, response: '', mentioned: false, citations: [] };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  const mentionedClaude = results.filter(r => r.mentioned);
  const sentimentSummary = {
    positive: mentionedClaude.filter(r => r.sentiment === 'positive').length,
    negative: mentionedClaude.filter(r => r.sentiment === 'negative').length,
    neutral:  mentionedClaude.filter(r => r.sentiment === 'neutral').length,
  };
  const allCitations = results.flatMap(r => r.citations || []);
  console.log(`[Claude] ${mentionCount}/${queries.length} → ${score}pt / 引用URL: ${allCitations.length}件`);
  return { score, mentionCount, totalQueries: queries.length, details: results, citations: allCitations, sentiment: sentimentSummary };
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
      const citations = [];
      const aiOverview = data.ai_overview;

      if (aiOverview) {
        const overviewText = typeof aiOverview === 'string'
          ? aiOverview
          : JSON.stringify(aiOverview);
        mentioned = checkMention(overviewText, brandNames);

        // ai_overview.sources から引用URLを抽出
        const sources = aiOverview.sources || aiOverview.references || [];
        sources.forEach(s => { if (s && s.link) citations.push(s.link); });

        // ai_overview.text_blocks 内のリンクも抽出
        const blocks = aiOverview.text_blocks || [];
        blocks.forEach(b => {
          (b.references || []).forEach(ref => { if (ref.link) citations.push(ref.link); });
        });
      }

      if (!mentioned && data.organic_results) {
        const combinedText = data.organic_results.slice(0, 3)
          .map(r => `${r.title || ''} ${r.snippet || ''}`)
          .join(' ');
        mentioned = checkMention(combinedText, brandNames);
      }

      // 有機検索上位5件のURLも引用源として収集
      if (data.organic_results) {
        data.organic_results.slice(0, 5).forEach(r => { if (r.link) citations.push(r.link); });
      }

      return { query, hasAiOverview: !!aiOverview, mentioned, citations };
    } catch (err) {
      console.error(`[GoogleAI] クエリエラー: ${err.message}`);
      return { query, hasAiOverview: false, mentioned: false, citations: [] };
    }
  }));

  const mentionCount = results.filter(r => r.mentioned).length;
  const score = queries.length > 0
    ? Math.round((mentionCount / queries.length) * 100)
    : 0;

  const allGoogleAICitations = results.flatMap(r => r.citations || []);
  console.log(`[GoogleAI] ${mentionCount}/${queries.length} → ${score}pt / 引用URL: ${allGoogleAICitations.length}件`);
  return { score, mentionCount, totalQueries: queries.length, details: results, citations: allGoogleAICitations };
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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

  // 逐次処理（429 quota exceeded 検出のため）
  const results = [];
  let quotaExceeded = false;
  for (const query of queries) {
    if (quotaExceeded) {
      results.push({ query, response: '', mentioned: false, _skipped: true });
      continue;
    }
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: query + '\n\n回答の最後に「参考URL:」として参照したウェブサイトのURLをリストアップしてください（例: https://example.com）。' }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.7 },
        }),
      });

      if (resp.status === 429) {
        const errBody = await resp.text().catch(() => '');
        console.warn(`[Gemini] レート制限(429) - 残りのクエリをスキップします: ${errBody.slice(0, 120)}`);
        quotaExceeded = true;
        results.push({ query, response: '', mentioned: false, _skipped: true });
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[Gemini] APIエラー: ${resp.status} - ${errText}`);
        results.push({ query, response: '', mentioned: false });
        continue;
      }

      const data = await resp.json();
      const response = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const mentioned = checkMention(response, brandNames);
      const citations = extractUrlsFromText(response);
      const sentiment = mentioned ? analyzeSentiment(response, brandNames) : null;
      results.push({ query, response, mentioned, citations, sentiment });
    } catch (err) {
      console.error(`[Gemini] クエリエラー: ${err.message}`);
      results.push({ query, response: '', mentioned: false });
    }
  }

  // 過半数がクォータでスキップされた場合は skipped として返す
  const skippedCount = results.filter(r => r._skipped).length;
  if (quotaExceeded && skippedCount > queries.length / 2) {
    console.warn(`[Gemini] クォータ超過により計測スキップ (${skippedCount}/${queries.length} クエリ未実行)`);
    return { score: 0, mentionCount: 0, totalQueries: 0, details: [], skipped: true, skipReason: 'quota_exceeded' };
  }

  const validResults = results.filter(r => !r._skipped);
  const mentionCount = validResults.filter(r => r.mentioned).length;
  const validTotal = validResults.length || 1;
  const score = Math.round((mentionCount / validTotal) * 100);

  const allGeminiCitations = results.flatMap(r => r.citations || []);
  const mentionedGemini = validResults.filter(r => r.mentioned);
  const sentimentSummary = {
    positive: mentionedGemini.filter(r => r.sentiment === 'positive').length,
    negative: mentionedGemini.filter(r => r.sentiment === 'negative').length,
    neutral:  mentionedGemini.filter(r => r.sentiment === 'neutral').length,
  };
  console.log(`[Gemini] ${mentionCount}/${validTotal} → ${score}pt (スキップ: ${skippedCount}件)`);
  return { score, mentionCount, totalQueries: validTotal, details: results, citations: allGeminiCitations, sentiment: sentimentSummary };
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
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`
    : null;

  // 全キーワードを並列処理（Promise.all）
  const updatedKeywords = await Promise.all(keywords.map(async (kw) => {
    const engines = [];

    // ChatGPT と Gemini を同時並列で実行
    if (openai) {
      engines.push(
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `「${kw.kw}」に関連する日本の会社・サービスを具体的にいくつか教えてください` }],
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
            contents: [{ parts: [{ text: `「${kw.kw}」に関連する日本の会社・サービスを具体的にいくつか教えてください` }] }],
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
 * キーワードごとに Google AI Overview（SerpAPI）で自社ブランドが言及されているか確認する
 * 同時にインプレッション推定値も取得（Google Search Console 連携前の暫定値）
 *
 * SerpAPI 無料プラン: 100クエリ/月 ← キーワード数 × 計測回数に注意
 *
 * @param {Array<{kw, vol, presence, change, status}>} keywords
 * @param {string[]} brandNames
 * @returns {Promise<Array>} - google_ai フィールドが更新されたキーワード配列
 */
async function measureKeywordGoogleAI(keywords, brandNames, brandDomain = null) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('[KW SerpAPI] SERPAPI_KEY が未設定のためスキップします');
    return keywords;
  }

  console.log(`[KW SerpAPI] ${keywords.length}件のキーワードのGoogle AI Overview確認中...`);

  // brandDomain を正規化（www. 除去、末尾スラッシュ除去）
  const normalizedDomain = brandDomain
    ? brandDomain.replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
    : null;

  const updatedKeywords = await Promise.all(keywords.map(async (kw) => {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', kw.kw);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('gl', 'jp');
      url.searchParams.set('hl', 'ja');
      url.searchParams.set('num', '10'); // 順位検出のため10件取得

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        console.error(`[KW SerpAPI] "${kw.kw}": APIエラー ${resp.status}`);
        return kw;
      }

      const data = await resp.json();

      // Google AI Overview にブランドが含まれているか
      let googleAI = false;
      if (data.ai_overview) {
        const overviewText = typeof data.ai_overview === 'string'
          ? data.ai_overview
          : JSON.stringify(data.ai_overview);
        googleAI = checkMention(overviewText, brandNames);
      }

      // オーガニック検索結果にも言及があるか確認（AI Overviewなしの場合の補足）
      let organicMention = false;
      if (!googleAI && data.organic_results) {
        const combinedText = data.organic_results.slice(0, 5)
          .map(r => `${r.title || ''} ${r.snippet || ''}`)
          .join(' ');
        organicMention = checkMention(combinedText, brandNames);
      }

      // オーガニック検索での自社ドメイン掲載順位を検出
      let serpPosition = null;
      if (normalizedDomain && data.organic_results) {
        for (const result of data.organic_results) {
          try {
            const resultHost = new URL(result.link).hostname.replace(/^www\./, '').toLowerCase();
            if (resultHost === normalizedDomain || resultHost.endsWith('.' + normalizedDomain)) {
              serpPosition = result.position;
              break;
            }
          } catch {}
        }
      }

      console.log(`[KW SerpAPI] "${kw.kw}": AI Overview=${googleAI ? '✓言及あり' : '✗なし'}, Organic=${organicMention ? '✓' : '✗'}, 順位=${serpPosition != null ? serpPosition + '位' : '圏外'}`);

      return {
        ...kw,
        google_ai: googleAI,
        google_organic: organicMention,
        serp_position: serpPosition,
      };
    } catch (err) {
      console.error(`[KW SerpAPI] "${kw.kw}": ${err.message}`);
      return kw;
    }
  }));

  return updatedKeywords;
}

/**
 * 競合スコア精度向上のため、Perplexityで「業界全社リストアップ」クエリを実行する
 * Perplexityはリアルタイム検索のため、中小規模の会社（サイバーバズ・Nateeなど）も検出しやすい
 * 自社計測の回答とは別に、競合検出に特化した回答を取得する
 *
 * @param {string} industry
 * @returns {Promise<Array<{query, response}>>} - 競合リストアップ用レスポンス配列
 */
async function measureCompetitorListings(industry) {
  const queries = (COMPETITOR_LISTING_QUERIES[industry] || []).slice(0, 3); // 最大3クエリ
  if (queries.length === 0) {
    console.log('[競合リスト] 業界クエリが未設定のためスキップします');
    return [];
  }

  console.log(`[競合リスト] Perplexityで${queries.length}件の網羅的リストアップクエリを実行中...`);

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
          max_tokens: 1200, // 多くの会社名を含めるため多めに
        }),
      });
      const data = await resp.json();
      const response = data.choices?.[0]?.message?.content || '';
      console.log(`[競合リスト] "${query.slice(0, 20)}...": ${response.length}文字取得`);
      return { query, response };
    } catch (err) {
      console.error(`[競合リスト] クエリエラー: ${err.message}`);
      return { query, response: '' };
    }
  }));

  return results.filter(r => r.response.length > 0);
}

/**
 * 自社計測で取得済みの AI レスポンスを再利用して競合スコアを算出する
 * 追加API呼び出しゼロ・高速・最も正確な競合比較が実現できる
 *
 * @param {Array<{name, score, trend, dir, color, self, names}>} competitors
 * @param {Array<{query, response, mentioned}>} existingResponses - 自社計測の全レスポンス
 * @param {number} selfScore - 自社の最新スコア
 * @returns {Array} - score/trend/dir が更新された競合配列
 */
function scoreCompetitorsFromResponses(competitors, existingResponses, selfScore = null) {
  if (!existingResponses || existingResponses.length === 0) {
    console.warn('[競合計測] レスポンスデータがないためスキップします');
    return competitors;
  }

  // レスポンスからテキスト部分だけ抽出（response / text フィールドに対応）
  const responseTexts = existingResponses
    .map(r => r.response || r.text || '')
    .filter(Boolean);

  console.log(`[競合計測] 既存レスポンス ${responseTexts.length}件を再利用して競合スコアを算出`);

  return competitors.map(comp => {
    // self エントリは自社スコアで更新
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

    // names 配列があればそれを使用、なければ name のみ
    const compBrandNames = comp.names && comp.names.length > 0 ? comp.names : [comp.name];

    const mentionCount = responseTexts.filter(text => checkMention(text, compBrandNames)).length;
    const newScore = responseTexts.length > 0
      ? Math.round((mentionCount / responseTexts.length) * 100)
      : comp.score || 0;

    const oldScore = comp.score || 0;
    const diff = newScore - oldScore;

    console.log(`[競合計測] ${comp.name}: ${mentionCount}/${responseTexts.length}件に言及 → ${newScore}pt (${diff >= 0 ? '+' : ''}${diff}pt)`);

    return {
      ...comp,
      score: newScore,
      trend: diff >= 0 ? `+${diff}pt` : `${diff}pt`,
      dir: diff >= 0 ? 'up' : 'down',
    };
  });
}

/**
 * インフルエンサーごとのAI言及数を自動計測する
 *
 * 各インフルエンサー名が、AIエンジンの回答の中でブランドと一緒に言及されているかを確認する。
 * ChatGPT + Perplexity に「{brandName} のインフルエンサー施策・コラボ」関連クエリを投げ、
 * 各回答の中にインフルエンサー名が含まれていればカウントする。
 *
 * @param {Array<{name, cat, handle?, impact?}>} influencers  - 登録済みインフルエンサー一覧
 * @param {string[]} brandNames  - 計測対象ブランド名
 * @param {string}   industry    - 業種（クエリの文脈に使用）
 * @returns {Promise<Array>}     - impact フィールドが更新されたインフルエンサー配列
 */
async function measureInfluencerMentions(influencers, brandNames, industry) {
  if (!influencers || influencers.length === 0) return influencers;

  const openaiKey     = process.env.OPENAI_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!openaiKey && !perplexityKey) {
    console.warn('[INF] APIキー未設定のためインフルエンサー計測をスキップ');
    return influencers;
  }

  const { OpenAI } = require('openai');
  const brand = brandNames[0] || '';

  // ブランド + インフルエンサー施策に関するクエリ群
  const queries = [
    `${brand}と協力しているSNSインフルエンサーを教えてください`,
    `${brand}のインフルエンサーマーケティング施策やコラボ事例を教えてください`,
    `${brand}を紹介しているYouTuberやInstagrammerはいますか？`,
    `${brand}のSNSプロモーションに関わったインフルエンサーを教えてください`,
    `${industry}業界でインフルエンサーと連携しているブランドの事例を教えてください`,
  ];

  // 両エンジンに一括クエリして応答テキストを収集
  const allTexts = [];

  try {
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      const responses = await Promise.all(
        queries.map(q =>
          openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: q }],
            max_tokens: 600,
            temperature: 0.7,
          })
          .then(r => r.choices[0].message.content || '')
          .catch(e => { console.error('[INF ChatGPT]', e.message); return ''; })
        )
      );
      allTexts.push(...responses);
    }

    if (perplexityKey) {
      const responses = await Promise.all(
        queries.map(q =>
          fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [{ role: 'user', content: q }],
              max_tokens: 600,
              temperature: 0.7,
            }),
          })
          .then(async r => r.ok ? (await r.json()).choices?.[0]?.message?.content || '' : '')
          .catch(e => { console.error('[INF Perplexity]', e.message); return ''; })
        )
      );
      allTexts.push(...responses);
    }
  } catch (e) {
    console.error('[INF] クエリ実行エラー:', e.message);
    return influencers;
  }

  const combinedText = allTexts.join('\n');
  const totalResponses = allTexts.filter(t => t.length > 0).length;

  // 各インフルエンサーについて言及数をカウント
  const updated = influencers.map(inf => {
    if (!inf.name) return inf;

    // 名前の表記ゆれを考慮（フルネーム、苗字だけ、ハンドルネーム）
    const variants = [inf.name];
    if (inf.handle) variants.push(inf.handle.replace(/^@/, ''));
    // 苗字（スペース区切りの最初の単語）
    const lastName = inf.name.split(/[\s　]/)[0];
    if (lastName && lastName !== inf.name) variants.push(lastName);

    const mentionCount = allTexts.filter(text =>
      variants.some(v => text.includes(v))
    ).length;

    // impact = 言及数（最大は totalResponses）
    const oldImpact = inf.impact || 0;
    const newImpact = mentionCount;

    console.log(`[INF] ${inf.name}: ${mentionCount}/${totalResponses} 回言及 (前回: ${oldImpact})`);

    return {
      ...inf,
      impact: newImpact,
      impactChange: newImpact - oldImpact,
      lastMeasured: new Date().toISOString().split('T')[0],
    };
  });

  return updated;
}

/**
 * インフルエンサー施策カテゴリ別にAI言及数を集計し barData を生成する
 *
 * @param {Array<{name, cat, impact}>} influencers
 * @returns {Array<{label, val}>}
 */
function buildBarDataFromInfluencers(influencers) {
  if (!influencers || influencers.length === 0) return [];
  const catMap = {};
  for (const inf of influencers) {
    const cat = inf.cat || 'その他';
    catMap[cat] = (catMap[cat] || 0) + (inf.impact || 0);
  }
  return Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, val]) => ({ label, val }));
}

module.exports = {
  measureWithChatGPT,
  aggregateCitationsByDomain,
  analyzeSentiment,
  measureWithPerplexity,
  measureWithGoogleAI,
  measureWithGemini,
  measureWithClaude,
  measureKeywordPresences,
  measureKeywordGoogleAI,
  measureCompetitorListings,
  scoreCompetitorsFromResponses,
  measureInfluencerMentions,
  buildBarDataFromInfluencers,
  getWeekStart,
  getCurrentMonth,
  INDUSTRY_QUERIES,
};
