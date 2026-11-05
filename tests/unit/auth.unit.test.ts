import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { login } from "../../src/controllers/auth.controller";

const { query, from, compare, sign } = vi.hoisted(() => {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn();

  return {
    query,
    from: vi.fn(() => query),
    compare: vi.fn(),
    sign: vi.fn(),
  };
});

vi.mock("../../src/config/supabase", () => ({
  supabase: { from },
}));

vi.mock("bcrypt", () => ({
  default: { compare },
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign },
}));

const activeUser = {
  id: "user-1",
  username: "alice",
  password_hash: "hashed-password",
  role: "customer",
  member_tier: "gold",
  status: "active", // เป็นข้อมูลประกอบ mock เท่านั้น ไม่ได้ทดสอบเงื่อนไขนี้
};

// ---------- login ----------
describe("login ตาม FR-0.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("ล็อกอินสำเร็จเมื่อ username และ password ถูกต้อง", async () => {
    query.maybeSingle.mockResolvedValue({ data: activeUser, error: null });
    compare.mockResolvedValue(true);
    sign.mockReturnValue("test-token");

    const req = {
      body: { username: "alice", password: "correct-password" },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      accessToken: "test-token",
      user: {
        id: "user-1",
        username: "alice",
        role: "customer",
        memberTier: "gold",
      },
    });
  });

  it("ปฏิเสธเมื่อไม่พบ username", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    const req = {
      body: { username: "unknown", password: "correct-password" },
    } as unknown as Request;

    await expect(login(req, {} as Response)).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("ปฏิเสธเมื่อ password ไม่ตรง", async () => {
    query.maybeSingle.mockResolvedValue({ data: activeUser, error: null });
    compare.mockResolvedValue(false);

    const req = {
      body: { username: "alice", password: "wrong-password" },
    } as unknown as Request;

    await expect(login(req, {} as Response)).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });
});
