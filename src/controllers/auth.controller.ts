import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase";

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    console.log("Login username:", username);

    if (!username || !password) {
      return res.status(401).json({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid username or password"
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password_hash, role")
      .eq("username", username)
      .single();

    // เช็กว่า Database หา user เจอไหม
    console.log("Database user:", user);
    console.log("Database error:", error);

    if (error || !user) {
      return res.status(401).json({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid username or password"
      });
    }

    // เช็ก password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log("Password match:", passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid username or password"
      });
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

    return res.status(200).json({
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
}