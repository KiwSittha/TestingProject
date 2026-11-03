import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../src/utils/errors";
import { getProduct } from "../src/services/cart.service";
import { updateProduct } from "../src/controllers/admin.controller";

// จำลอง Supabase chain
const { query } = vi.hoisted(() => {
  const query: any = {};
  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.single = vi.fn();

  return { query };
});

vi.mock("../src/config/supabase", () => ({
  supabase: { from: vi.fn(() => query) },
}));

vi.mock("../src/services/cart.service", () => ({
  getProduct: vi.fn(),
}));

describe("updateProduct ตาม FR-9.1.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // ถ้าโค้ดยอมให้อัปเดต จะได้ผลลัพธ์นี้กลับจาก Supabase
    query.single.mockResolvedValue({
      data: {
        id: "product-1",
        price: 50001,
        available_stock: 10000,
      },
      error: null,
    });
  });

  it("แจ้ง PRODUCT_NOT_FOUND ก่อน แม้ค่าที่ส่งมาจะไม่ถูกต้องด้วย", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new ApiError("PRODUCT_NOT_FOUND", "Product not found"),
    );

    const req = {
      params: { id: "missing-product" },
      body: { price: 0, stock: 10000 },
    } as unknown as Request;

    const res = {} as Response;

    await expect(updateProduct(req, res)).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  it("แจ้งชื่อทุกฟิลด์ที่เกินช่วงที่กำหนด", async () => {
    vi.mocked(getProduct).mockResolvedValue({ id: "product-1" } as any);

    const req = {
      params: { id: "product-1" },
      body: { price: 50001, stock: 10000 },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await expect(updateProduct(req, res)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { fields: ["price", "stock"] },
    });
  });
});