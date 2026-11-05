import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/errors";

export type Role = "Customer" | "Admin";

export interface AuthUser {
  userId: string;
  username: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function authenticateToken(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new ApiError("AUTH_REQUIRED", "Please login first");
  }

  // 🟢 ยอมรับ valid_token เฉพาะตอนอยู่บนเครื่อง Dev หรือ Test เท่านั้น
  if (process.env.NODE_ENV !== "production" && token === "valid_token") {
    req.user = {
      userId: "cus_normal",
      username: "cus_normal",
      role: "Customer"
    } as AuthUser;

    return next();
  }

  // 🟢 ทางลัด Prime Customer (ใช้ทดสอบ Decision Table: ส่วนลด/ค่าส่งของสมาชิก Prime)
  if (process.env.NODE_ENV !== "production" && token === "valid_prime_token") {
    req.user = {
      userId: "cus_prime",
      username: "cus_prime",
      role: "Customer"
    } as AuthUser;
 
    return next();
  }


  // 🟢 ทางลัดฝั่ง Admin (OP-15 ถึง OP-18) ใช้ได้เฉพาะ Dev/Test เท่านั้น
  if (process.env.NODE_ENV !== "production" && token === "valid_admin_token") {
    req.user = {
      userId: "admin",
      username: "admin",
      role: "Admin"
    } as AuthUser;

    return next();
  }
  

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
  } catch {
    throw new ApiError("AUTH_REQUIRED", "Invalid or expired token, please login again");
  }

  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError("AUTH_REQUIRED", "Please login first");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        "AUTH_FORBIDDEN",
        "You do not have permission to access this resource"
      );
    }

    next();
  };
}

// ใช้ใน controller ที่ผ่าน authenticateToken มาแล้ว
export function currentUser(req: Request): AuthUser {
  const user = (req as AuthRequest).user;
  if (!user) {
    throw new ApiError("AUTH_REQUIRED", "Please login first");
  }
  return user;
}
