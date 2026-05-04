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

// Wraps a handler — returns 401 if JWT missing/invalid
function requireAuth(handler) {
  return async (req, res) => {
    try {
      req.user = await verifyJWT(req);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
    return handler(req, res);
  };
}

module.exports = { verifyJWT, requireAuth };
