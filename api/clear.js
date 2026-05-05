// POST /api/clear  — ADMIN (JWT required)
// Wipes all entries from the queue table and used_tokens table
// Requires confirmation header to prevent accidental calls

const { db } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { requireAuth } = require("./_auth");

module.exports = requireAuth(async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Require explicit confirmation in body to prevent accidental wipes
  const { confirm } = req.body || {};
  if (confirm !== "CLEAR_QUEUE") {
    return res.status(400).json({
      error: 'Missing confirmation. Send { "confirm": "CLEAR_QUEUE" } in the request body.'
    });
  }

  const supabase = db();

  const [queueResult, tokenResult] = await Promise.all([
    supabase.from("queue").delete().neq("queue_number", 0), // delete all rows
    supabase.from("used_tokens").delete().neq("token", ""),  // delete all rows
  ]);

  if (queueResult.error) {
    return res.status(500).json({ error: "Failed to clear queue: " + queueResult.error.message });
  }

  if (tokenResult.error) {
    return res.status(500).json({ error: "Failed to clear tokens: " + tokenResult.error.message });
  }

  return res.status(200).json({ ok: true, message: "Queue and token store cleared." });
});
