import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "quiz_app_admin_secret_key_2026_super_secure";

export function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Admin authorization token required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Not an authorized admin.",
      });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token. Please log in again.",
    });
  }
}

export function generateAdminToken(adminData) {
  return jwt.sign(
    {
      username: adminData.username,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}
