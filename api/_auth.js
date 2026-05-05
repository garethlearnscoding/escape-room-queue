const { adminClient } = require("./_supabase");

// Verify token by asking Supabase directly — works with all key formats
async function verifyJWT(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new Error("Missing or malformed Authorization header");
  }

  const token = auth.replace("Bearer ", "").trim();

  const { data, error } = await adminClient().auth.getUser(token);

  if (error || !data?.user) {
    throw new Error("Invalid or expired token");
  }

  return data.user;
}

function requireAuth(handler) {
  return async (req, res) => {
    try {
      req.user = await verifyJWT(req);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
    try {
      return await handler(req, res); // ✅ now caught
    } catch (err) {
      console.error("[requireAuth] Unhandled error in handler:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = { verifyJWT, requireAuth };
