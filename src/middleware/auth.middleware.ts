import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: "Customer" | "Admin";
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      code: "AUTH_UNAUTHORIZED",
      message: "Access token is required"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as AuthRequest["user"];

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      code: "AUTH_INVALID_TOKEN",
      message: "Invalid or expired token"
    });
  }
}

export function requireRole(
  ...allowedRoles: Array<"Customer" | "Admin">
) {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        code: "AUTH_UNAUTHORIZED",
        message: "Unauthorized"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: "AUTH_FORBIDDEN",
        message: "You do not have permission to access this resource"
      });
    }

    next();
  };
}