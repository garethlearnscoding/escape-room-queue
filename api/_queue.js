const fs = require("fs");
const FILE = "/tmp/queue.json";

function getRedis() {
  const Redis = require("ioredis");
  return new Redis(process.env.REDIS_URL || "redis://localhost:6379");
}

const useRedis = !!(process.env.REDIS_URL || process.env.USE_REDIS);
const KEY = "escape-queue";
const EMPTY = () => ({ queue: [], served: 0, usedTokens: [] });

let client = null;
function redis() {
  if (!client) client = getRedis();
  return client;
}

async function read() {
  if (useRedis) {
    const raw = await redis().get(KEY);
    if (!raw) return EMPTY();
    try { return JSON.parse(raw); } catch { return EMPTY(); }
  }
  if (!fs.existsSync(FILE)) return EMPTY();
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return EMPTY(); }
}

async function save(data) {
  if (useRedis) {
    await redis().set(KEY, JSON.stringify(data));
    return;
  }
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = { read, save };
