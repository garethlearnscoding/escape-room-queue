// POST /api/join  — PUBLIC
// Always joins as "waiting" — booth manually calls with /api/call

const { getActive, insertEntry, isTokenUsed, markTokenUsed } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { validateToken, validateName } = require("./_validate");

const TWO_MINUTES = 2 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let token, name;
  try {
    token = validateToken(req.body?.token);
    name = validateName(req.body?.name);
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

  if (Date.now() - tokenTime > TWO_MINUTES) {
    return res.status(400).json({ error: "Token expired" });
  }

  if (await isTokenUsed(token)) {
    return res.status(400).json({ error: "This QR code has already been used to join." });
  }

  await markTokenUsed(token);

  const active = await getActive();
  const now = Date.now();

  // Always join as waiting — booth operator decides when to call
  const row = await insertEntry({
    name,
    token,
    status: "waiting",
    joinedAt: now,
    notifiedAt: null,
  });

  return res.status(200).json({
    id: row.queue_number,
    queueNumber: row.queue_number,
    label: row.name,
    position: active.length + 1,
    total: active.length + 1,
    status: "waiting",
    notifiedAt: null,
  });
};
