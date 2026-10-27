import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase";
import { ApiError, dbCheck } from "../utils/errors";
import { getBody } from "../utils/validate";
import type { UserRow } from "../types/db.types";

function invalidCredentials() {
  return new ApiError("AUTH_INVALID_CREDENTIALS", "Invalid username or password");
}

// OP-1 login: POST /login
export async function login(req: Request, res: Response) {
  const { username, password } = getBody(req);

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    throw invalidCredentials();
  }

  const user = dbCheck(
    await supabase
      .from("users")
      .select("id, username, password_hash, role, member_tier, status")
      .eq("username", username)
      .maybeSingle<UserRow>(),
    "Load user"
  );

  // เช็ก user และ password
  if (!user || user.status !== "active") {
    throw invalidCredentials();
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    throw invalidCredentials();
  }

  // สร้าง JWT
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "1h"
    }
  );

  res.status(200).json({
    accessToken: token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      memberTier: user.member_tier
    }
  });
}
