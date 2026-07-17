-- ============================================================
-- Public lobby catalog policy
-- ============================================================
-- The home page is public, so anonymous users must be able to read
-- active/beta game manifests. Hidden/maintenance/coming_soon entries
-- remain blocked unless another policy allows them.

DROP POLICY IF EXISTS "Authenticated users can read games" ON games;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'games'
      AND policyname = 'Public users can read active games'
  ) THEN
    CREATE POLICY "Public users can read active games"
      ON games FOR SELECT
      USING (status IN ('active', 'beta'));
  END IF;
END $$;
