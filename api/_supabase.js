const { createClient } = require("@supabase/supabase-js");

// Service role client — backend only, never exposed to frontend
let _admin = null;
function adminClient() {
  if (!_admin) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    }
    _admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _admin;
}

module.exports = { adminClient };
