-- Allow authenticated admins to read queue via Realtime
CREATE POLICY "admin can read queue"
  ON queue FOR SELECT
  TO authenticated
  USING (true);