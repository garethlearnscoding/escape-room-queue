const { createClient } = require("@supabase/supabase-js");

let _client = null;

function db() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _client;
}

// Returns all active queue entries (waiting or notified), ordered by queue_number
async function getActive() {
  const { data, error } = await db()
    .from("queue")
    .select("*")
    .in("status", ["waiting", "notified"])
    .order("queue_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Returns a single entry by queue_number or id
async function getEntry(queueNumber) {
  const { data, error } = await db()
    .from("queue")
    .select("*")
    .eq("queue_number", queueNumber)
    .single();
  if (error) return null;
  return data;
}

// Insert a new entry, returns the full inserted row (with queue_number)
async function insertEntry({ name, token, status, joinedAt, notifiedAt }) {
  const { data, error } = await db()
    .from("queue")
    .insert({
      name,
      token,
      status,
      joined_at: joinedAt,
      notified_at: notifiedAt || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Update status (and optionally notified_at) for a given queue_number
async function updateStatus(queueNumber, status, notifiedAt = null) {
  const updates = { status };
  if (notifiedAt) updates.notified_at = notifiedAt;
  const { error } = await db()
    .from("queue")
    .update(updates)
    .eq("queue_number", queueNumber);
  if (error) throw error;
}

// Check if token has been used
async function isTokenUsed(token) {
  const TWO_MIN_AGO = Date.now() - 2 * 60 * 1000;
  // Purge old tokens first
  await db().from("used_tokens").delete().lt("used_at", TWO_MIN_AGO);
  const { data } = await db()
    .from("used_tokens")
    .select("token")
    .eq("token", token)
    .single();
  return !!data;
}

// Mark token as used
async function markTokenUsed(token) {
  await db()
    .from("used_tokens")
    .upsert({ token, used_at: Date.now() });
}

// Served count
async function getServedCount() {
  const { count } = await db()
    .from("queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "served");
  return count || 0;
}

// Clear all entries and used tokens
async function clearEntries() {
  const { error: error1 } = await db().from("queue").delete().neq("queue_number", -1);
  if (error1) throw error1;
  const { error: error2 } = await db().from("used_tokens").delete().neq("token", "none");
}

module.exports = { db, getActive, getEntry, insertEntry, updateStatus, isTokenUsed, markTokenUsed, getServedCount, clearEntries };