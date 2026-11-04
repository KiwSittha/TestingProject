import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../src/utils/errors";
import { setCouponStatus, listCoupons } from '../src/controllers/admin.controller';

// จำลอง Supabase chain
const { query } = vi.hoisted(() => {
  const query: any = {};

  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.returns = vi.fn();
  query.order = vi.fn(() => query);

  return { query };
});

vi.mock("../src/config/supabase", () => ({
  supabase: { from: vi.fn(() => query) },
}));

function makeRequest(code: string, status: unknown): Request {
  return {
    params: { id: code },
    body: { status },
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

// ---------- setCouponStatus ----------
describe("setCouponStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("เปิดใช้ coupon ได้", async () => {
    const updatedCoupon = { code: "SAVE10", status: "ปิดใช้" };

    query.returns.mockResolvedValue({
      data: [updatedCoupon],
      error: null,
    });

    const res = makeResponse();
    await setCouponStatus(makeRequest("SAVE10", 1), res);

    expect(query.update).toHaveBeenCalledWith({ status: "เปิดใช้" });
    expect(query.eq).toHaveBeenCalledWith("code", "SAVE10");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Coupon status updated",
      coupon: updatedCoupon,
    });
  });

  it("แจ้ง COUPON_NOT_FOUND เมื่อไม่มี coupon", async () => {
    query.returns.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(
      setCouponStatus(makeRequest("MISSING", 0), {} as Response),
    ).rejects.toMatchObject({
      code: "COUPON_NOT_FOUND",
    });
  });
});

// ---------- listCoupons ----------
describe("listCoupons", () => {
  it("ส่งรายการ coupon กลับมาเมื่อพบข้อมูล", async () => {
    const coupons = [{ code: "SAVE10" }];

    query.returns.mockResolvedValue({ data: coupons, error: null });

    const res = makeResponse();
    await listCoupons({} as Request, res);

    expect(query.order).toHaveBeenCalledWith("code");
    expect(res.json).toHaveBeenCalledWith({ coupons });
  });

  it("ส่งรายการว่างเมื่อไม่มี coupon", async () => {
    query.returns.mockResolvedValue({ data: [], error: null });

    const res = makeResponse();
    await listCoupons({} as Request, res);

    expect(res.json).toHaveBeenCalledWith({ coupons: [] });
  });

  it("โยน error เมื่อ query ฐานข้อมูลไม่สำเร็จ", async () => {
    query.returns.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });

    await expect(
      listCoupons({} as Request, makeResponse()),
    ).rejects.toThrow("List coupons: Database unavailable");
  });
});
