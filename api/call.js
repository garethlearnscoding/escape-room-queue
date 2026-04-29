const { read, save } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const data = await read();
  const WINDOW = 5 * 60 * 1000;
  const now = Date.now();

  const notifiedCount = data.queue.filter(e => e.status === "notified" && (now - (e.notifiedAt || 0) < WINDOW)).length;

  if (notifiedCount >= 2) {
    return res.status(400).json({ error: "Already 2 people notified. Serve or remove someone first." });
  }

  // Find the first person in line who is "waiting"
  const nextIndex = data.queue.findIndex(e => e.status === "waiting");

  if (nextIndex === -1) {
    return res.status(200).json({ message: "No one waiting in queue" });
  }

  // Notify that person
  data.queue[nextIndex].status = "notified";
  data.queue[nextIndex].notifiedAt = now;

  await save(data);

  return res.status(200).json({
    called: data.queue[nextIndex].label,
    status: "notified"
  });
};
