// Input validation helpers — throw on invalid input

function validateToken(token) {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Missing token");
  }
  return token.trim();
}

function validateName(name) {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Missing name");
  }
  if (name.trim().length > 50) {
    throw new Error("Name must be 50 characters or fewer");
  }
  return name.trim();
}

function validateId(id) {
  const num = parseInt(id, 10);
  if (isNaN(num) || num < 1) {
    throw new Error("Invalid id");
  }
  return num;
}

module.exports = { validateToken, validateName, validateId };
