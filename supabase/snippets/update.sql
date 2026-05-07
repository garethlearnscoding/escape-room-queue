-- Add theme column
ALTER TABLE queue
  ADD COLUMN theme text NOT NULL DEFAULT 'helios'
  CHECK (theme IN ('helios', 'circus'));

-- Replace RPC to accept theme filter
CREATE OR REPLACE FUNCTION get_active_queue(p_theme text DEFAULT NULL)
RETURNS SETOF queue LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM queue
  WHERE status IN ('waiting', 'notified')
    AND (p_theme IS NULL OR theme = p_theme)
  ORDER BY queue_number ASC;
$$;
