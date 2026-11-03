import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../src/utils/errors";
import { updateProduct, setProductStatus, setCouponStatus, listCoupons } from '../src/controllers/admin.controller';
import { login } from '../src/controllers/auth.controller';
import { addCartItem, updateCartItem, removeCartItem, applyCoupon, viewCart } from '../src/controllers/cart.controller';
import { pay, checkout, cancelOrder, listOrders, viewOrder } from '../src/controllers/order.controller';
import { getProducts } from '../src/controllers/product.controller';
import { getOrCreateCart, getCartLines, getProduct } from '../src/services/cart.service'
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

  it("อัปเดตราคาและ stock ได้เมื่อข้อมูลถูกต้อง", async () => {
  const existingProduct = {
    id: "product-1",
    price: 300,
    available_stock: 5,
  };

  const updatedProduct = {
    id: "product-1",
    price: 500,
    available_stock: 10,
  };

  vi.mocked(getProduct).mockResolvedValue(existingProduct as any);

  // จำลองผลที่ Supabase ส่งกลับหลังอัปเดต
  query.single.mockResolvedValue({
    data: updatedProduct,
    error: null,
  });

  const req = {
    params: { id: "product-1" },
    body: { price: 500, stock: 10 },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;

  await expect(updateProduct(req, res)).resolves.toBeUndefined();

  expect(getProduct).toHaveBeenCalledWith("product-1");
  expect(query.update).toHaveBeenCalledWith(
    expect.objectContaining({
      price: 500,
      available_stock: 10,
    }),
  );
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({
    message: "Product updated",
    product: updatedProduct,
  });
});
});