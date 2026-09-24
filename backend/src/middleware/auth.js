import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findById(payload.userId).select("-password");

    if (!user || user.accountStatus !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Admin authorization required." });
  }
  next();
}

