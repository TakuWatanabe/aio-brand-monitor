// lib/data.js
// クライアントデータ（本番ではFirestore等のDBに移行）

const CLIENTS = [
  {
    id: "kose",
    email: "marketing@kose.co.jp",
    name: "コーセー株式会社",
    short: "コ",
    color: "#9D174D",
    industry: "化粧品・スキンケア",
    userName: "佐藤 美咲",
    userRole: "マーケティング部 デジタル担当",
    score: 78,
    scoreChange: "+6",
    rank: 2,
    kpi: [
      { label: "AI言及数（今月）", val: "4,820", unit: "件", change: "+22.4%", dir: "up", c: "blue", icon: "🤖" },
      { label: "AIOスコア", val: "78", unit: "pt", change: "+6pt", dir: "up", c: "green", icon: "📊" },
      { label: "AI検索シェア（業界内）", val: "23.4", unit: "%", change: "+3.1pt", dir: "up", c: "purple", icon: "🔍" },
      { label: "インフルエンサー施策ROI", val: "420", unit: "%", change: "+55pt", dir: "up", c: "orange", icon: "💹" },
    ],
    trend: [
      { month: "10月", mentions: 2100, score: 62 }, { month: "11月", mentions: 2480, score: 66 },
      { month: "12月", mentions: 2900, score: 69 }, { month: "1月", mentions: 3400, score: 72 },
      { month: "2月", mentions: 4100, score: 75 }, { month: "3月", mentions: 4820, score: 78 },
    ],
    engines: [
      { name: "ChatGPT", val: 42, change: "+8%", color: "#10B981" },
      { name: "Perplexity", val: 28, change: "+12%", color: "#6366F1" },
      { name: "Google AI Overview", val: 22, change: "+5%", color: "#F59E0B" },
      { name: "その他AI", val: 8, change: "+2%", color: "#6B7280" },
    ],
    keywords: [
      { kw: "スキンケア おすすめ", vol: "82K", presence: 74, change: "+12%", status: "high" },
      { kw: "コーセー 美白", vol: "34K", presence: 88, change: "+8%", status: "high" },
      { kw: "日焼け止め 人気", vol: "61K", presence: 52, change: "+5%", status: "mid" },
      { kw: "敏感肌 化粧品", vol: "48K", presence: 44, change: "-3%", status: "mid" },
      { kw: "クレンジング おすすめ", vol: "55K", presence: 38, change: "+1%", status: "mid" },
      { kw: "コスメ プチプラ", vol: "94K", presence: 21, change: "-8%", status: "low" },
      { kw: "美容液 効果", vol: "39K", presence: 62, change: "+15%", status: "high" },
      { kw: "化粧水 ランキング", vol: "72K", presence: 55, change: "+4%", status: "mid" },
    ],
    competitors: [
      { name: "資生堂", color: "#EF4444", score: 85, trend: "+4%", dir: "up" },
      { name: "コーセー（自社）", color: "#9D174D", score: 78, trend: "+6%", dir: "up", self: true },
      { name: "花王", color: "#F59E0B", score: 72, trend: "+2%", dir: "up" },
      { name: "カネボウ", color: "#8B5CF6", score: 65, trend: "-1%", dir: "down" },
      { name: "ポーラ", color: "#6366F1", score: 61, trend: "+3%", dir: "up" },
    ],
    influencers: [
      { name: "田中 さくら", emoji: "🌸", bg: "#FDF2F8", cat: "ビューティー", impact: 312, detail: "スキンケア投稿でAI引用数急増" },
      { name: "伊藤 みお", emoji: "👗", bg: "#F0FDF4", cat: "ファッション", impact: 148, detail: "コーデ投稿でブランド言及" },
      { name: "中村 りく", emoji: "💪", bg: "#FFF1F2", cat: "フィットネス", impact: 98, detail: "UVケア訴求が好評" },
    ],
    barData: [
      { label: "田中さくら", val: 312, color: "#EC4899" },
      { label: "伊藤みお", val: 148, color: "#6366F1" },
      { label: "中村りく", val: 98, color: "#10B981" },
      { label: "PR記事", val: 76, color: "#F59E0B" },
      { label: "その他", val: 42, color: "#6B7280" },
    ],
    insight: "競合・資生堂がAIスコア85で首位をキープ中。「スキンケア おすすめ」「美容液 効果」のキーワードでAI上の存在感が伸びています。田中さくら起用の継続と、敏感肌カテゴリへの追加施策でシェア逆転が狙えます。",
  },
  {
    id: "uniqlo",
    email: "digital@fastretailing.com",
    name: "株式会社ファーストリテイリング",
    short: "ユ",
    color: "#DC2626",
    industry: "ファッション・アパレル",
    userName: "鈴木 健一",
    userRole: "グローバルマーケティング部 デジタル戦略",
    score: 82,
    scoreChange: "+9",
    rank: 1,
    kpi: [
      { label: "AI言及数（今月）", val: "8,340", unit: "件", change: "+31.2%", dir: "up", c: "blue", icon: "🤖" },
      { label: "AIOスコア", val: "82", unit: "pt", change: "+9pt", dir: "up", c: "green", icon: "📊" },
      { label: "AI検索シェア（業界内）", val: "38.2", unit: "%", change: "+6.4pt", dir: "up", c: "purple", icon: "🔍" },
      { label: "インフルエンサー施策ROI", val: "580", unit: "%", change: "+88pt", dir: "up", c: "orange", icon: "💹" },
    ],
    trend: [
      { month: "10月", mentions: 4200, score: 68 }, { month: "11月", mentions: 5100, score: 72 },
      { month: "12月", mentions: 5900, score: 74 }, { month: "1月", mentions: 6800, score: 77 },
      { month: "2月", mentions: 7600, score: 80 }, { month: "3月", mentions: 8340, score: 82 },
    ],
    engines: [
      { name: "ChatGPT", val: 48, change: "+14%", color: "#10B981" },
      { name: "Perplexity", val: 24, change: "+9%", color: "#6366F1" },
      { name: "Google AI Overview", val: 20, change: "+7%", color: "#F59E0B" },
      { name: "その他AI", val: 8, change: "+1%", color: "#6B7280" },
    ],
    keywords: [
      { kw: "ファッション おすすめ", vol: "120K", presence: 82, change: "+18%", status: "high" },
      { kw: "ユニクロ 新作", vol: "68K", presence: 91, change: "+11%", status: "high" },
      { kw: "プチプラ コーデ", vol: "95K", presence: 64, change: "+9%", status: "high" },
      { kw: "秋冬 トレンド", vol: "78K", presence: 71, change: "+6%", status: "high" },
      { kw: "パンツ 人気", vol: "44K", presence: 55, change: "+2%", status: "mid" },
      { kw: "カジュアル コーデ", vol: "62K", presence: 48, change: "-2%", status: "mid" },
      { kw: "メンズ ファッション", vol: "88K", presence: 62, change: "+7%", status: "high" },
      { kw: "レディース 通勤", vol: "51K", presence: 39, change: "-1%", status: "mid" },
    ],
    competitors: [
      { name: "ファーストリテイリング（自社）", color: "#DC2626", score: 82, trend: "+9%", dir: "up", self: true },
      { name: "しまむら", color: "#F59E0B", score: 71, trend: "+3%", dir: "up" },
      { name: "GU", color: "#10B981", score: 68, trend: "+5%", dir: "up" },
      { name: "ZARA JAPAN", color: "#6366F1", score: 63, trend: "+1%", dir: "up" },
      { name: "H&M JAPAN", color: "#6B7280", score: 54, trend: "-2%", dir: "down" },
    ],
    influencers: [
      { name: "橋本 そら", emoji: "🎮", bg: "#FAF5FF", cat: "ゲーム", impact: 488, detail: "カジュアルウェアとのコラボが話題" },
      { name: "伊藤 みお", emoji: "👗", bg: "#F0FDF4", cat: "ファッション", impact: 342, detail: "コーデ紹介がAI引用を多数獲得" },
      { name: "山田 健太", emoji: "🍜", bg: "#FFF7ED", cat: "グルメ", impact: 156, detail: "食×ファッションの切り口で拡散" },
    ],
    barData: [
      { label: "橋本そら", val: 488, color: "#8B5CF6" },
      { label: "伊藤みお", val: 342, color: "#EC4899" },
      { label: "山田健太", val: 156, color: "#F59E0B" },
      { label: "PR記事", val: 122, color: "#6366F1" },
      { label: "その他", val: 68, color: "#6B7280" },
    ],
    insight: "業界内AI検索シェア38.2%で首位。「ユニクロ 新作」「ファッション おすすめ」でAI上の露出が引き続き強力です。GUとの差別化コンテンツとメンズカテゴリのさらなる強化で業界シェア40%超えが視野に入ります。",
  },
  {
    id: "ajinomoto",
    email: "digital@ajinomoto.com",
    name: "味の素株式会社",
    short: "味",
    color: "#D97706",
    industry: "食品・調味料",
    userName: "田村 直樹",
    userRole: "ブランド戦略部 デジタルマーケティング",
    score: 64,
    scoreChange: "+2",
    rank: 3,
    kpi: [
      { label: "AI言及数（今月）", val: "2,140", unit: "件", change: "+8.3%", dir: "up", c: "blue", icon: "🤖" },
      { label: "AIOスコア", val: "64", unit: "pt", change: "+2pt", dir: "up", c: "green", icon: "📊" },
      { label: "AI検索シェア（業界内）", val: "16.8", unit: "%", change: "+0.9pt", dir: "up", c: "purple", icon: "🔍" },
      { label: "インフルエンサー施策ROI", val: "240", unit: "%", change: "+18pt", dir: "up", c: "orange", icon: "💹" },
    ],
    trend: [
      { month: "10月", mentions: 1480, score: 58 }, { month: "11月", mentions: 1620, score: 59 },
      { month: "12月", mentions: 1750, score: 60 }, { month: "1月", mentions: 1880, score: 61 },
      { month: "2月", mentions: 2010, score: 63 }, { month: "3月", mentions: 2140, score: 64 },
    ],
    engines: [
      { name: "ChatGPT", val: 35, change: "+4%", color: "#10B981" },
      { name: "Perplexity", val: 31, change: "+6%", color: "#6366F1" },
      { name: "Google AI Overview", val: 26, change: "+3%", color: "#F59E0B" },
      { name: "その他AI", val: 8, change: "+1%", color: "#6B7280" },
    ],
    keywords: [
      { kw: "料理 おすすめ調味料", vol: "55K", presence: 52, change: "+6%", status: "mid" },
      { kw: "味の素 レシピ", vol: "28K", presence: 78, change: "+9%", status: "high" },
      { kw: "うまみ 活用", vol: "18K", presence: 65, change: "+11%", status: "high" },
      { kw: "健康 食事 おすすめ", vol: "72K", presence: 22, change: "-4%", status: "low" },
      { kw: "簡単 夕飯 レシピ", vol: "98K", presence: 18, change: "-6%", status: "low" },
      { kw: "だし おすすめ", vol: "34K", presence: 44, change: "+3%", status: "mid" },
      { kw: "減塩 料理", vol: "41K", presence: 38, change: "+7%", status: "mid" },
      { kw: "グルタミン酸 食品", vol: "12K", presence: 71, change: "+14%", status: "high" },
    ],
    competitors: [
      { name: "キッコーマン", color: "#DC2626", score: 72, trend: "+5%", dir: "up" },
      { name: "ヤマキ", color: "#F59E0B", score: 68, trend: "+3%", dir: "up" },
      { name: "味の素（自社）", color: "#D97706", score: 64, trend: "+2%", dir: "up", self: true },
      { name: "ミツカン", color: "#8B5CF6", score: 60, trend: "+1%", dir: "up" },
      { name: "日清フーズ", color: "#6B7280", score: 54, trend: "-1%", dir: "down" },
    ],
    influencers: [
      { name: "山田 健太", emoji: "🍜", bg: "#FFF7ED", cat: "グルメ", impact: 228, detail: "レシピ動画でAI検索引用を大量獲得" },
      { name: "中村 りく", emoji: "💪", bg: "#FFF1F2", cat: "フィットネス", impact: 112, detail: "スポーツ栄養×調味料の切り口" },
      { name: "田中 さくら", emoji: "🌸", bg: "#FDF2F8", cat: "ビューティー", impact: 68, detail: "美容×食事コンテンツで言及" },
    ],
    barData: [
      { label: "山田健太", val: 228, color: "#F59E0B" },
      { label: "中村りく", val: 112, color: "#10B981" },
      { label: "田中さくら", val: 68, color: "#EC4899" },
      { label: "PR記事", val: 54, color: "#6366F1" },
      { label: "その他", val: 32, color: "#6B7280" },
    ],
    insight: "「健康 食事 おすすめ」「簡単 夕飯 レシピ」など大型キーワードでのAI存在感が弱く、業界3位に留まっています。山田健太さんを軸にしたレシピ系コンテンツの継続強化と、「減塩料理」カテゴリへの積極投資が競合逆転の鍵です。",
  },
];

/**
 * メールアドレスからクライアントデータを取得
 * @param {string} email
 * @returns {object|null}
 */
function getClientByEmail(email) {
  return CLIENTS.find((c) => c.email === email) || null;
}

/**
 * IDからクライアントデータを取得
 * @param {string} id
 * @returns {object|null}
 */
function getClientById(id) {
  return CLIENTS.find((c) => c.id === id) || null;
}

module.exports = { CLIENTS, getClientByEmail, getClientById };
