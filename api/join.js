const { read, save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");
const { randomUUID } = require("crypto");

const TWO_MINUTES = 2 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(res, req);
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

  const data = await read();
  if (!data.usedTokens) data.usedTokens = [];

  const now = Date.now();
  data.usedTokens = data.usedTokens.filter(t => now - t.time < TWO_MINUTES);

  if (data.usedTokens.find(t => t.token === token)) {
    return res.status(400).json({ error: "This QR code has already been used to join." });
  }

  data.usedTokens.push({ token, time: now });

  if (data.totalJoined === undefined) data.totalJoined = (data.served || 0) + data.queue.length;
  data.totalJoined += 1;
  const ticketNumber = data.totalJoined;

  const id = randomUUID();
  const entry = {
    id,
    ticketNumber,
    label: name.trim(),
    joinedAt: now,
    status: "waiting",
    notifiedAt: null,
  };

  data.queue.push(entry);
  await save(data);

  const position = data.queue.findIndex(e => e.id === id) + 1;

  return res.status(200).json({
    id,
    ticketNumber,
    label: entry.label,
    position,
    total: data.queue.length,
    status: entry.status,
    notifiedAt: entry.notifiedAt,
  });
};
