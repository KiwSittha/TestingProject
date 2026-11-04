import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/utils/errors";
import { getProduct } from "../../src/services/cart.service";

const { query } = vi.hoisted(() => {
  const query: any = {};

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn();

  return { query };
});

vi.mock("../../src/config/supabase", () => ({
  supabase: { from: vi.fn(() => query) },
}));

// ---------- getProduct ----------
describe("getProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ECP: productId ที่มีสินค้าอยู่ในระบบ
  it("คืนข้อมูลสินค้าเมื่อพบสินค้า", async () => {
    const product = { id: "product-1", name: "Book" };

    query.maybeSingle.mockResolvedValue({
      data: product,
      error: null,
    });

    await expect(getProduct("product-1")).resolves.toEqual(product);
    expect(query.eq).toHaveBeenCalledWith("id", "product-1");
  });

  // ECP: productId ที่ไม่มีสินค้าในระบบ
  it("โยน PRODUCT_NOT_FOUND เมื่อไม่พบสินค้า", async () => {
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(getProduct("missing-product")).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
  });

  // Error path ของ dependency: Supabase query ล้มเหลว
  it("โยน error เมื่อ query ฐานข้อมูลผิดพลาด", async () => {
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "Database unavailable" },
    });

    await expect(getProduct("product-1")).rejects.toThrow(
      "Load product: Database unavailable",
    );
  });
});
