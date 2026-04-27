const { read, save } = require("./_queue");
const { randomUUID } = require("crypto");

const TWO_MINUTES = 2 * 60 * 1000;

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { token, name } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing token" });
  if (!name || !name.trim()) return res.status(400).json({ error: "Missing name" });

  // Decode and validate token
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

  const data = read();

  // Initialise usedTokens list if it doesn't exist
  if (!data.usedTokens) data.usedTokens = [];

  // Purge tokens older than 2 minutes to keep the list small
  const now = Date.now();
  data.usedTokens = data.usedTokens.filter(t => now - t.time < TWO_MINUTES);

  // Reject if this exact token has already been used to join
  if (data.usedTokens.find(t => t.token === token)) {
    return res.status(400).json({ error: "This QR code has already been used to join." });
  }

  // Mark token as consumed
  data.usedTokens.push({ token, time: now });

  const id = randomUUID();
  const position = data.queue.length + 1;

  const entry = {
    id,
    label: name.trim(),
    joinedAt: now,
    status: data.queue.length === 0 ? "notified" : "waiting",
    notifiedAt: data.queue.length === 0 ? now : null,
  };

  data.queue.push(entry);
  save(data);

  return res.status(200).json({
    id,
    label: entry.label,
    position,
    total: data.queue.length,
    status: entry.status,
    notifiedAt: entry.notifiedAt,
  });
};
