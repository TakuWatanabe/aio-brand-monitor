-- ============================================================
-- GEO Radar Migration SQL
-- Run this in Supabase SQL Editor to enable GEO Radar features
-- Project: aio-brand-monitor
-- ============================================================

-- â  campaigns ãã¼ãã«
-- GEOæ½ç­ã­ã£ã³ãã¼ã³ã®ç»é²ã»æ¯è¼ç®¡ç
CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                          -- ã­ã£ã³ãã¼ã³å
  start_date    DATE,                                   -- éå§æ¥
  end_date      DATE,                                   -- çµäºæ¥
  keywords      TEXT[],                                 -- å¯¾è±¡ã­ã¼ã¯ã¼ãéå
  target_score  INT DEFAULT 60,                         -- ç®æ¨AIOã¹ã³â¢
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active','completed','paused')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_client_id_idx ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx    ON campaigns(status);

-- â¡ campaign_scores ãã¼ãã«
-- ã­ã£ã³ãã¼ã³æéä¸­ã®AIOã¹ã³ã¢æ¨ç§»ï¼Before/Afteræ¯è¼ç¨ï¼
CREATE TABLE IF NOT EXISTS campaign_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  measured_at   DATE NOT NULL,
  aio_score     INT,                                    -- ç·åAIOã¹ã³â¢
  chatgpt_score INT,
  perplexity_score INT,
  google_aio_score INT,
  gemini_score  INT,
  claude_score  INT,
  citation_count INT DEFAULT 0,                         -- AIå¼ç¨æ°åè¨
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_scores_campaign_id_idx ON campaign_scores(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_scores_measured_at_idx ON campaign_scores(measured_at);

-- â¢ geo_scores ãã¼ãã«
-- ã¤ã³ãã«ã¨ã³ãµã¼å¥ã¯GEOé©æ§ã¹ã³ã¢å±¥æ­´
CREATE TABLE IF NOT EXISTS geo_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id   UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  scored_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  geo_score       NUMERIC(5,2),                         -- ç·åGEOã¹ã³ã¢(0-100)
  platform_score  NUMERIC(5,2),                         -- ãã©ãããã©ã¼ã ä¿æ°ã¹ã³ã¢
  follower_score  NUMERIC(5,2),                         -- ãã©ã­ã¯ã¼ã¹ã³ã¢
  expertise_score NUMERIC(5,2),                         -- å°éæ§ã¹ã³ã¢
  citation_bonus  NUMERIC(5,2),                         -- AIå¼ç¨å®ç¸¾ãã¼ãã¹
  -- AIå¼ç¨ç¶æ³ãã©ã°
  cited_by_chatgpt     BOOLEAN DEFAULT FALSE,
  cited_by_perplexity  BOOLEAN DEFAULT FALSE,
  cited_by_google_aio  BOOLEAN DEFAULT FALSE,
  cited_by_gemini      BOOLEAN DEFAULT FALSE,
  cited_by_claude      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS geo_scores_influencer_id_idx ON geo_scores(influencer_id);
CREATE INDEX IF NOT EXISTS geo_scores_client_id_idx     ON geo_scores(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS geo_scores_unique_daily
  ON geo_scores(influencer_id, scored_at);

-- â£ ai_citations ãã¼ãã«
-- AIã¨ã³ã¸ã³å¥ã®å®éã®å¼ç¨ãã©ãã­ã³ã°
CREATE TABLE IF NOT EXISTS ai_citations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL,
  campaign_id   UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ai_engine     TEXT NOT NULL
                CHECK (ai_engine IN ('chatgpt','perplexity','google_aio','gemini','claude')),
  keyword       TEXT,                                   -- æ¤ç´¢ã¯ã¨ãª
  cited_url     TEXT,                                   -- å¼ç¨ãããURL
  citation_text TEXT,                                   -- å¼ç¨ããããã­ã¹ãæç²
  is_brand_mentioned BOOLEAN DEFAULT FALSE,            -- ãã©ã³ãåãå«ã¾ããã
  measured_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_citations_client_id_idx     ON ai_citations(client_id);
CREATE INDEX IF NOT EXISTS ai_citations_influencer_id_idx ON ai_citations(influencer_id);
CREATE INDEX IF NOT EXISTS ai_citations_campaign_id_idx   ON ai_citations(campaign_id);
CREATE INDEX IF NOT EXISTS ai_citations_ai_engine_idx     ON ai_citations(ai_engine);
CREATE INDEX IF NOT EXISTS ai_citations_measured_at_idx   ON ai_citations(measured_at);

-- â¤ clients ãã¼ãã«ã¸ã®GEOé¢é£ã«ã©ã è¿½å 
-- (æ¢å­ãã¼ãã«ã«è¿½å )
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS geo_enabled        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS geo_target_score   INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS geo_baseline_score INT,      -- è¨æ¸¬éå§æã®ã¹ã³ã¢
  ADD COLUMN IF NOT EXISTS geo_current_score  INT;      -- ææ°GEOã¹ã³ã¢

-- â¥ influencers ãã¼ãã«ã¸ã®GEOé¢é£ã«ã©ã è¿½å 
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS geo_score        NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS geo_platform     TEXT,       -- ä¸»è¦ãã©ãããã©ã¼ã 
  ADD COLUMN IF NOT EXISTS geo_scored_at    DATE,
  ADD COLUMN IF NOT EXISTS eeteat_score     NUMERIC(5,2), -- E-E-A-Tææ°
  ADD COLUMN IF NOT EXISTS citation_history JSONB DEFAULT '{}'; -- AIå¼ç¨å±¥æ­´

-- ============================================================
-- RLS (Row Level Security) ããªã·ã¼
-- ============================================================

ALTER TABLE campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_citations    ENABLE ROW LEVEL SECURITY;

-- Anon users: read-only for their own client data (via JWT claims)
CREATE POLICY IF NOT EXISTS "campaigns_select"
  ON campaigns FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "campaign_scores_select"
  ON campaign_scores FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "geo_scores_select"
  ON geo_scores FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "ai_citations_select"
  ON ai_citations FOR SELECT USING (true);

-- Service role: full access (used by API functions)
CREATE POLICY IF NOT EXISTS "campaigns_service_all"
  ON campaigns FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "campaign_scores_service_all"
  ON campaign_scores FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "geo_scores_service_all"
  ON geo_scores FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "ai_citations_service_all"
  ON ai_citations FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ãµã³ãã«ãã¼ã¿ï¼åä½ç¢ºèªç¨ï¼
-- ============================================================

-- ã³ã¼ã»ã¼ã®ãµã³ãã«ã­ã£ã³ãã¼ã³ï¼clients.idãå®éã®IDã«ç½®ãæãã¦ãã ããï¼
/*
INSERT INTO campaigns (client_id, name, start_date, end_date, keywords, target_score, status)
SELECT
  id,
  'ç¾ç½è¨´æ±ã¤ã³ãã«ã¨ã³ãµã¼æ½ç­ Q2',
  '2026-04-01',
  '2026-06-30',
  ARRAY['ã³ã¼ã»ã¼ ç¾ç½', 'ã¹ã­ã³ã±ã¢ ãããã', 'ç¾å®¹æ¶² å¹æ'],
  70,
  'active'
FROM clients
WHERE name ILIKE '%ã³ã¼ã»ã¼%'
LIMIT 1;
*/

-- ============================================================
-- ç¢ºèªã¯ã¨ãª
-- ============================================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('campaigns', 'campaign_scores', 'geo_scores', 'ai_citations')
ORDER BY table_name, ordinal_position;
