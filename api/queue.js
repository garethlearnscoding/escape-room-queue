// /api/queue
//
// GET    — ADMIN  — fetch full queue with stats
// POST   — PUBLIC — join queue
// PATCH  — MIXED  — queue actions (body: { action, id? })
//   "call"    — admin:  notify first waiting person
//   "serve"   — admin:  mark person as served, promote next
//   "noshow"  — admin:  mark person as no-show, promote next
//   "leave"   — public: user voluntarily leaves queue
// DELETE — ADMIN  — wipe entire queue + token store

const {
  db, getActive, getEntry, insertEntry,
  isTokenUsed, markTokenUsed, updateStatus,
  getServedCount, getUsedTokens,
} = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { verifyJWT } = require("./_auth");
const { validateToken, validateName, validateId } = require("./_validate");

const TWO_MINUTES  = 2 * 60 * 1000;
const NOTIFY_WINDOW = 5 * 60 * 1000;

// Inline auth check — writes 401 and returns false on failure
async function requireAdmin(req, res) {
  try {
    req.user = await verifyJWT(req);
    return true;
  } catch (err) {
    res.status(401).json({ error: err.message });
    return false;
  }
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  try {

    // ── GET — public status check (if ?id=) or admin queue view
    if (req.method === "GET") {

      // Public: GET /api/queue?id=<queue_number>  (was /api/status)
      if (req.query.id !== undefined) {
        let id;
        try { id = validateId(req.query.id); }
        catch (err) { return res.status(400).json({ error: err.message }); }

        const entry = await getEntry(id);
        if (!entry) return res.status(404).json({ error: "Not in queue" });

        if (entry.status === "served" || entry.status === "noshow") {
          return res.status(200).json({ status: entry.status });
        }

        const active   = await getActive();
        const position = active.findIndex(e => e.queue_number === entry.queue_number) + 1;

        return res.status(200).json({
          id:          entry.queue_number,
          queueNumber: entry.queue_number,
          label:       entry.name,
          position,
          peopleAhead: position - 1,
          total:       active.length,
          status:      entry.status,
          notifiedAt:  entry.notified_at ? new Date(entry.notified_at).toISOString() : null,
        });
      }

      // Admin: GET /api/queue  (Bearer required)
      if (!await requireAdmin(req, res)) return;

      const [active, served, usedTokens] = await Promise.all([
        getActive(),
        getServedCount(),
        getUsedTokens(),
      ]);

      const now = Date.now();
      return res.status(200).json({
        queue: active.map((e, i) => {
          const notifiedMs = e.notified_at ?? null;
          return {
            id:          e.queue_number,
            queueNumber: e.queue_number,
            label:       e.name,
            position:    i + 1,
            status:      e.status,
            joinedAt:    e.joined_at,
            notifiedAt:  notifiedMs,
            expired:     notifiedMs ? (now - notifiedMs) > NOTIFY_WINDOW : false,
          };
        }),
        total: active.length,
        served,
        usedTokens,
      });
    }

    // ── POST — public join ────────────────────────────────────
    if (req.method === "POST") {
      let token, name;
      try {
        token = validateToken(req.body?.token);
        name  = validateName(req.body?.name);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      let tokenTime;
      try {
        tokenTime = parseInt(Buffer.from(token, "base64").toString("utf8"), 10);
        if (isNaN(tokenTime)) throw new Error();
      } catch {
        return res.status(400).json({ error: "Invalid token" });
      }

      if (Date.now() - tokenTime > TWO_MINUTES)
        return res.status(400).json({ error: "Token expired" });

      if (await isTokenUsed(token))
        return res.status(400).json({ error: "This QR code has already been used to join." });

      await markTokenUsed(token);

      const active = await getActive();
      const row = await insertEntry({
        name, token, status: "waiting",
        joinedAt: Date.now(), notifiedAt: null,
      });

      return res.status(200).json({
        id:          row.queue_number,
        queueNumber: row.queue_number,
        label:       row.name,
        position:    active.length + 1,
        total:       active.length + 1,
        status:      "waiting",
        notifiedAt:  null,
      });
    }

    // ── PATCH — queue actions ─────────────────────────────────
    if (req.method === "PATCH") {
      const { action, id: rawId } = req.body || {};

      // "leave" is the only public action (user removes themselves)
      if (action === "leave") {
        let id;
        try { id = validateId(rawId); }
        catch (err) { return res.status(400).json({ error: err.message }); }

        const entry = await getEntry(id);
        if (!entry || entry.status === "served")
          return res.status(404).json({ error: "Not found" });

        const wasNotified = entry.status === "notified";
        await updateStatus(id, "served");

        if (wasNotified) {
          const active = await getActive();
          if (active.length > 0)
            await updateStatus(active[0].queue_number, "notified", Date.now());
        }
        return res.status(200).json({ ok: true });
      }

      // All other actions require admin auth
      if (!await requireAdmin(req, res)) return;

      if (action === "call") {
        const active  = await getActive();
        const waiting = active.filter(e => e.status === "waiting");

        if (waiting.length === 0) {
          const alreadyCalled = active.some(e => e.status === "notified");
          if (alreadyCalled)
            return res.status(400).json({ error: "Someone is already being called." });
          return res.status(200).json({ message: "No one waiting", called: null });
        }

        const next = waiting[0];
        await updateStatus(next.queue_number, "notified", Date.now());
        return res.status(200).json({
          called: next.name,
          calledQueueNumber: next.queue_number,
        });
      }

      if (action === "serve" || action === "noshow") {
        let id;
        try { id = validateId(rawId); }
        catch { return res.status(400).json({ error: "Invalid or missing id" }); }

        const { data: entry } = await db()
          .from("queue").select("*").eq("queue_number", id).single();

        if (!entry || entry.status === "served" || entry.status === "noshow")
          return res.status(404).json({ error: "Entry not found or already resolved" });

        const wasNotified = entry.status === "notified";
        const newStatus   = action === "serve" ? "served" : "noshow";
        await updateStatus(id, newStatus);

        if (wasNotified) {
          const active      = await getActive();
          const nextWaiting = active.find(e => e.status === "waiting");
          if (nextWaiting)
            await updateStatus(nextWaiting.queue_number, "notified", Date.now());
        }

        return res.status(200).json(
          action === "serve"
            ? { served: entry.name, servedQueueNumber: entry.queue_number }
            : { removed: entry.name, removedQueueNumber: entry.queue_number }
        );
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    // ── DELETE — admin clear ──────────────────────────────────
    if (req.method === "DELETE") {
      if (!await requireAdmin(req, res)) return;

      const supabase = db();
      const [queueResult, tokenResult] = await Promise.all([
        supabase.from("queue").delete().neq("queue_number", 0),
        supabase.from("used_tokens").delete().neq("token", ""),
      ]);

      if (queueResult.error)
        return res.status(500).json({ error: "Failed to clear queue: " + queueResult.error.message });
      if (tokenResult.error)
        return res.status(500).json({ error: "Failed to clear tokens: " + tokenResult.error.message });

      return res.status(200).json({ ok: true, message: "Queue and token store cleared." });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("[/api/queue] Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
