const fs = require("fs");
const FILE = "/tmp/queue.json";

function read() {
  if (!fs.existsSync(FILE)) return save({ queue: [], served: 0 }) || read();
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return save({ queue: [], served: 0 }) || read(); }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  return null;
}

module.exports = { read, save };
