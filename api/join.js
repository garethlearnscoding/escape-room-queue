const { getActive, insertEntry, isTokenUsed, markTokenUsed } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

const TWO_MINUTES = 2 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, name } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing token" });
  if (!name || !name.trim()) return res.status(400).json({ error: "Missing name" });

  let tokenTime;
  try {
    tokenTime = parseInt(Buffer.from(token, "base64").toString("utf8"), 10);
    if (isNaN(tokenTime)) throw new Error();
  } catch {
    return res.status(400).json({ error: "Invalid token" });
  }

  if (Date.now() - tokenTime > TWO_MINUTES) {
    return res.status(400).json({ error: "Token expired" });
  }

  if (await isTokenUsed(token)) {
    return res.status(400).json({ error: "This QR code has already been used to join." });
  }

  await markTokenUsed(token);

  const active = await getActive();
  const isFirst = active.length === 0;
  const now = Date.now();

  const row = await insertEntry({
    name: name.trim(),
    token,
    status: isFirst ? "notified" : "waiting",
    joinedAt: now,
    notifiedAt: isFirst ? now : null,
  });

  return res.status(200).json({
    id: row.queue_number,
    queueNumber: row.queue_number,
    label: row.name,
    position: active.length + 1,
    total: active.length + 1,
    status: row.status,
    // ISO string — client caches this and counts down locally
    notifiedAt: row.notified_at ? new Date(row.notified_at).toISOString() : null,
  });
};