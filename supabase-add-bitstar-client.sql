-- ============================================================
-- BitStar クライアント登録SQL
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- competitor_names カラムが未追加の場合は追加（JSONB型）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS competitor_names JSONB DEFAULT '[]';

-- brand_names は既存のカラム型に合わせて text[] で扱う
-- （既に text[] で存在する場合はそのまま使用）

-- BitStar クライアントデータを挿入
INSERT INTO clients (
  id,
  email,
  name,
  short,
  color,
  industry,
  user_name,
  user_role,
  brand_name,
  brand_names,
  current_score,
  score_change,
  rank,
  kpi,
  trend,
  engines,
  keywords,
  competitors,
  competitor_names,
  influencers,
  bar_data,
  insight,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@your-domain.com',
  '株式会社BitStar',
  'BitStar',
  '#2E75B6',
  'インフルエンサーマーケティング',
  '管理者ユーザー',
  'マーケティング担当',
  'BitStar',
  ARRAY['BitStar', 'ビットスター'],
  0,
  '+0',
  1,
  '[
    {"label": "AIOスコア",        "val": "0",  "unit": "pt", "change": "計測前", "up": true},
    {"label": "ChatGPT露出率",    "val": "0",  "unit": "%",  "change": "計測前", "up": true},
    {"label": "Perplexity露出率", "val": "0",  "unit": "%",  "change": "計測前", "up": true},
    {"label": "計測クエリ数",      "val": "0",  "unit": "件", "change": "計測前", "up": true}
  ]'::jsonb,
  '[]'::jsonb,
  '[
    {"name": "ChatGPT",    "score": 0, "color": "#10B981"},
    {"name": "Perplexity", "score": 0, "color": "#8B5CF6"}
  ]'::jsonb,
  '[]'::jsonb,
  '[
    {"name": "Anymind",    "score": 0, "self": false},
    {"name": "サイバーバズ",  "score": 0, "self": false},
    {"name": "トレンダーズ",  "score": 0, "self": false},
    {"name": "Natee",      "score": 0, "self": false},
    {"name": "Grove",      "score": 0, "self": false},
    {"name": "BitStar",    "score": 0, "self": true}
  ]'::jsonb,
  '["Anymind", "サイバーバズ", "トレンダーズ", "Natee", "Grove"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'BitStarのAI露出データを計測中です。「計測する」ボタンを押すと最新スコアが表示されます。',
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name             = EXCLUDED.name,
  industry         = EXCLUDED.industry,
  brand_name       = EXCLUDED.brand_name,
  brand_names      = EXCLUDED.brand_names,
  competitor_names = EXCLUDED.competitor_names,
  competitors      = EXCLUDED.competitors,
  engines          = EXCLUDED.engines,
  kpi              = EXCLUDED.kpi,
  updated_at       = NOW();

-- 登録確認（このクエリ結果が表示されれば成功）
SELECT id, name, email, industry, brand_name, brand_names FROM clients WHERE email = 'admin@your-domain.com';
