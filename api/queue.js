const { getActive, getServedCount } = require("./_queue");
const { setCors, handleOptions } = require("./_cors");

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const [active, served] = await Promise.all([getActive(), getServedCount()]);

  return res.status(200).json({
    queue: active.map((e, i) => ({
      id: e.queue_number,
      queueNumber: e.queue_number,
      label: e.name,
      position: i + 1,
      status: e.status,
      joinedAt: new Date(e.joined_at).toISOString(),
      notifiedAt: e.notified_at ? new Date(e.notified_at).toISOString() : null,
    })),
    total: active.length,
    served,
  });
};