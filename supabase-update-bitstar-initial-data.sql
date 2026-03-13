-- BitStar クライアントに初期ダッシュボードデータを追加
-- Supabase SQL Editor で実行してください

UPDATE clients SET
  short       = 'BS',
  color       = '#1F3864',
  user_name   = '渡邉 拓',
  user_role   = 'マーケティング担当',
  current_score = 42,
  score_change  = '+0',
  rank          = 3,
  insight       = 'インフルエンサーマーケティング業界でのAI検索露出を強化するには、BitStarキャスティング案件の事例コンテンツを増やし、AI引用されやすいFAQ形式の記事を整備することが効果的です。まずAIOスコア計測を実施して現状を把握してください。',

  kpi = '[
    {"c":"blue",   "icon":"🤖", "label":"AIOスコア",       "val":"42",  "unit":"pt",   "dir":"up",   "change":"+0pt"},
    {"c":"green",  "icon":"💬", "label":"AI言及数",         "val":"0",   "unit":"件/週", "dir":"up",   "change":"+0件"},
    {"c":"purple", "icon":"🔍", "label":"AI検索シェア",     "val":"0",   "unit":"%",    "dir":"up",   "change":"+0pt"},
    {"c":"orange", "icon":"📈", "label":"競合比較",         "val":"3",   "unit":"位",   "dir":"up",   "change":"+0位"}
  ]'::jsonb,

  trend = '[
    {"month":"10月", "mentions":0, "score":0},
    {"month":"11月", "mentions":0, "score":0},
    {"month":"12月", "mentions":0, "score":0},
    {"month":"1月",  "mentions":0, "score":0},
    {"month":"2月",  "mentions":0, "score":0},
    {"month":"3月",  "mentions":0, "score":42}
  ]'::jsonb,

  engines = '[
    {"name":"ChatGPT",            "val":50, "color":"#10A37F", "change":"+0%"},
    {"name":"Perplexity",         "val":30, "color":"#5436DA", "change":"+0%"},
    {"name":"Google AI Overview", "val":20, "color":"#4285F4", "change":"+0%"}
  ]'::jsonb,

  keywords = '[
    {"kw":"インフルエンサーマーケティング", "vol":"月間1.2万", "presence":15, "change":"--", "status":"low"},
    {"kw":"インフルエンサー キャスティング","vol":"月間8千",  "presence":10, "change":"--", "status":"low"},
    {"kw":"YouTuber タイアップ",          "vol":"月間6千",  "presence":8,  "change":"--", "status":"low"},
    {"kw":"TikTok マーケティング",        "vol":"月間2万",  "presence":5,  "change":"--", "status":"low"},
    {"kw":"BitStar インフルエンサー",     "vol":"月間3千",  "presence":30, "change":"--", "status":"mid"},
    {"kw":"ビットスター",                 "vol":"月間2千",  "presence":25, "change":"--", "status":"mid"}
  ]'::jsonb,

  competitors = '[
    {"name":"Anymind",    "color":"#2E75B6", "score":68, "dir":"up",   "trend":"▲3", "self":false},
    {"name":"サイバーバズ","color":"#8B5CF6", "score":55, "dir":"up",   "trend":"▲1", "self":false},
    {"name":"BitStar",    "color":"#1F3864", "score":42, "dir":"up",   "trend":"▲0", "self":true},
    {"name":"トレンダーズ","color":"#F59E0B", "score":38, "dir":"down", "trend":"▼2", "self":false},
    {"name":"Natee",      "color":"#10B981", "score":35, "dir":"up",   "trend":"▲1", "self":false},
    {"name":"Grove",      "color":"#EF4444", "score":30, "dir":"down", "trend":"▼1", "self":false}
  ]'::jsonb,

  influencers = '[]'::jsonb,

  bar_data = '[
    {"label":"未計測", "val":1, "color":"#9CA3AF"}
  ]'::jsonb

WHERE email = 't.watanabe@bitstar.tokyo';

-- 確認
SELECT id, name, email, current_score, short, color, user_name
FROM clients
WHERE email = 't.watanabe@bitstar.tokyo';
