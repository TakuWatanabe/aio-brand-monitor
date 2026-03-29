-- ============================================================
-- AIO Brand Monitor — Supabase マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- ① settings カラム（通知・アラート設定）
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "alertEmail": true,
    "weeklyEmail": true,
    "alertThreshold": 10,
    "measureFreq": "daily"
  }'::jsonb;

-- ② profile 用カラム（user_name, user_role, short, color は既存の場合スキップ）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_name  TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_role  TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS short      TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS color      TEXT DEFAULT '#2E75B6';

-- ③ score_alert カラム（日次クロンのアラートフラグ）
ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_alert    TEXT    DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_alert_at TIMESTAMPTZ DEFAULT NULL;

-- ④ ai_scores テーブル（週次/日次スコア履歴）
CREATE TABLE IF NOT EXISTS ai_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ai_engine     TEXT NOT NULL,        -- 'chatgpt' | 'perplexity' | 'google_ai' | 'gemini' | 'chatgpt_daily' | 'perplexity_daily'
  score         INTEGER NOT NULL DEFAULT 0,
  mention_count INTEGER NOT NULL DEFAULT 0,
  total_queries INTEGER NOT NULL DEFAULT 0,
  week_start    DATE NOT NULL,        -- その週の月曜日の日付
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, ai_engine, week_start)
);

-- ai_scores インデックス
CREATE INDEX IF NOT EXISTS ai_scores_client_week ON ai_scores(client_id, week_start DESC);
CREATE INDEX IF NOT EXISTS ai_scores_engine      ON ai_scores(ai_engine);

-- ⑤ Row Level Security（RLS）設定
-- clients テーブル: 自分のレコードのみ SELECT 可能（service_role は全件アクセス可）
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own" ON clients;
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT
  USING (
    auth.email() = email
    OR (SELECT role FROM auth.users WHERE id = auth.uid()) = 'service_role'
  );

-- ai_scores テーブル: clients に紐づくデータのみ SELECT 可能
ALTER TABLE ai_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_scores_select_own" ON ai_scores;
CREATE POLICY "ai_scores_select_own" ON ai_scores
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.email()
    )
  );

-- ============================================================
-- 確認クエリ（実行後に確認してください）
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'clients' ORDER BY ordinal_position;
