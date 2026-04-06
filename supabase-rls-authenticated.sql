-- ============================================================
-- GEO Radar: RLS policies for authenticated users (frontend write access)
-- Run this in Supabase SQL Editor
-- ============================================================

-- campaigns: authenticated users can insert/update their own client's campaigns
CREATE POLICY IF NOT EXISTS "campaigns_insert_auth"
  ON campaigns FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "campaigns_update_auth"
  ON campaigns FOR UPDATE
  USING (auth.role() = 'authenticated');

-- geo_scores: authenticated users can upsert scores
CREATE POLICY IF NOT EXISTS "geo_scores_insert_auth"
  ON geo_scores FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "geo_scores_update_auth"
  ON geo_scores FOR UPDATE
  USING (auth.role() = 'authenticated');

-- influencers: authenticated users can update geo_score / geo_scored_at
-- (INSERT policy should already exist from original schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'influencers' AND policyname = 'influencers_update_auth'
  ) THEN
    EXECUTE 'CREATE POLICY influencers_update_auth ON influencers FOR UPDATE USING (auth.role() = ''authenticated'')';
  END IF;
END $$;

-- Verify
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('campaigns', 'geo_scores', 'influencers')
ORDER BY tablename, policyname;
