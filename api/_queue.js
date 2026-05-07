const { adminClient } = require("./_supabase");

function db() { return adminClient(); }

// Active = waiting or notified only (excludes served and noshow)
// Pass theme to filter by room ('helios' | 'circus'), or omit for all
async function getActive(theme = null) {
  const args = theme ? { p_theme: theme } : {};
  const { data, error } = await db().rpc("get_active_queue", args);
  if (error) throw error;
  return data || [];
}

async function getEntry(queueNumber) {
  const { data } = await db()
    .from("queue")
    .select("*")
    .eq("queue_number", queueNumber)
    .single();
  return data || null;
}

async function insertEntry({ name, token, status, joinedAt, notifiedAt, theme }) {
  const { data, error } = await db()
    .from("queue")
    .insert({
      name,
      token,
      status,
      joined_at: joinedAt,
      notified_at: notifiedAt || null,
      theme: theme || "helios",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateStatus(queueNumber, status, notifiedAt = null) {
  const updates = { status };
  if (notifiedAt) updates.notified_at = notifiedAt;
  const { error } = await db()
    .from("queue")
    .update(updates)
    .eq("queue_number", queueNumber);
  if (error) throw error;
}

async function isTokenUsed(token) {
  const TWO_MIN_AGO = Date.now() - 2 * 60 * 1000;
  await db().from("used_tokens").delete().lt("used_at", TWO_MIN_AGO);
  const { data } = await db()
    .from("used_tokens")
    .select("token")
    .eq("token", token)
    .single();
  return !!data;
}

async function markTokenUsed(token) {
  await db().from("used_tokens").upsert({ token, used_at: Date.now() });
}

async function getServedCount() {
  const { count } = await db()
    .from("queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "served");
  return count || 0;
}

async function getUsedTokens() {
  const TWO_MIN_AGO = Date.now() - 2 * 60 * 1000;
  const { data } = await db()
    .from("used_tokens")
    .select("token, used_at")
    .gt("used_at", TWO_MIN_AGO);
  return (data || []).map(t => ({ token: t.token, time: t.used_at }));
}

module.exports = {
  db,
  getActive,
  getEntry,
  insertEntry,
  updateStatus,
  isTokenUsed,
  markTokenUsed,
  getServedCount,
  getUsedTokens,
};
