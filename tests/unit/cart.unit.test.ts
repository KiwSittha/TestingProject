import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ApiError } from "../../src/utils/errors";
import {
  buildCartSummary,
  findCoupon,
  getCartLines,
  getOrCreateCart,
  getProduct,
  setCartCoupon,
} from "../../src/services/cart.service";
import {
  addCartItem,
  applyCoupon,
  removeCartItem,
  updateCartItem,
  viewCart,
  continueShopping,
} from "../../src/controllers/cart.controller";

const { query } = vi.hoisted(() => {
  const query: any = {};
  query.upsert = vi.fn();
  query.delete = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.select = vi.fn();

  return { query };
});

vi.mock("../../src/config/supabase", () => ({
  supabase: { from: vi.fn(() => query) },
}));

// จำลองการอ่าน/สรุปข้อมูล แต่ยังใช้ validation จริงจาก cart.service
vi.mock("../../src/services/cart.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/cart.service")>();

  return {
    ...actual,
    getProduct: vi.fn(),
    getOrCreateCart: vi.fn(),
    getCartLines: vi.fn(),
    buildCartSummary: vi.fn(),
    findCoupon: vi.fn(),
    setCartCoupon: vi.fn(),
  };
});

const product = {
  id: "product-1",
  name: "Book",
  status: "เปิดขาย",
  price: 100,
  available_stock: 20,
  weight_gram: 100,
};

const cart = { id: "cart-1" };

function makeRequest(
  quantity: unknown,
  productId = "product-1",
): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
    body: { productId, quantity },
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function makeRemoveRequest(
  productId: string,
  body: Record<string, unknown> = {},
): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
    params: { id: productId },
    body,
  } as unknown as Request;
}

function setup(
  productData = product,
  cartLines: any[] = [],
) {
  vi.mocked(getProduct).mockResolvedValue(productData as any);
  vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
  vi.mocked(getCartLines).mockResolvedValue(cartLines as any);
  vi.mocked(buildCartSummary).mockResolvedValue({} as any);
  query.upsert.mockResolvedValue({ data: null, error: null });
}

// ---------- addCartItem ----------
describe("addCartItem ตาม FR-2.1 ถึง FR-2.4 และ AC-1 ถึง AC-3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FR-2.1.1 — ECP: quantity ที่ไม่ใช่จำนวนเต็ม
  it("ปฏิเสธ quantity ที่ไม่ใช่จำนวนเต็มด้วย VALIDATION_ERROR", async () => {
    setup();

    await expect(
      addCartItem(makeRequest(1.5), makeResponse()),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // AC-1 / FR-2.1.2 — BVA: 0 ต่ำกว่าค่าต่ำสุด 1
  it("AC-1: ปฏิเสธ quantity 0 และไม่เขียนลงตะกร้า", async () => {
    const p1 = { ...product, id: "P1" };
    setup(p1, []);

    await expect(
      addCartItem(makeRequest(0, "P1"), makeResponse()),
    ).rejects.toMatchObject({
      code: "QTY_OUT_OF_RANGE",
    });

    expect(getProduct).not.toHaveBeenCalled();
    expect(getOrCreateCart).not.toHaveBeenCalled();
    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.1.2 — BVA: 11 สูงกว่าค่าสูงสุด 10
  it("ปฏิเสธ quantity 11 ด้วย QTY_OUT_OF_RANGE", async () => {
    setup();

    await expect(
      addCartItem(makeRequest(11), makeResponse()),
    ).rejects.toMatchObject({
      code: "QTY_OUT_OF_RANGE",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.2.1 — ECP: productId ที่ไม่มีในระบบ
  it("ปฏิเสธเมื่อไม่พบสินค้าด้วย PRODUCT_NOT_FOUND", async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new ApiError("PRODUCT_NOT_FOUND", "Product not found"),
    );

    await expect(
      addCartItem(makeRequest(1, "missing-product"), makeResponse()),
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.2.2 — ECP: สินค้าที่ไม่พร้อมขาย
  it("ปฏิเสธเมื่อสินค้าไม่พร้อมขายด้วย PRODUCT_UNAVAILABLE", async () => {
    setup({ ...product, status: "ปิดขาย" });

    await expect(
      addCartItem(makeRequest(1), makeResponse()),
    ).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // AC-11c / นิยามสินค้าพร้อมขาย: stock = 0 จึงเพิ่มลงตะกร้าไม่ได้
  it("ปฏิเสธสินค้า stock หมดด้วย PRODUCT_UNAVAILABLE", async () => {
    setup({ ...product, available_stock: 0 });

    await expect(
      addCartItem(makeRequest(1), makeResponse()),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.3.1 / BVA — 1, 2, 9, 10 ครบขอบเขตและค่าด้านในของช่วง 1–10
  it.each([1, 2, 9, 10])(
    "เพิ่มสินค้าใหม่ด้วย quantity %i ตามจำนวนที่ระบุ",
    async (quantity) => {
      setup();

      const res = makeResponse();
      await addCartItem(makeRequest(quantity), res);

      expect(query.upsert).toHaveBeenCalledWith(
        {
          cart_id: "cart-1",
          product_id: "product-1",
          quantity,
        },
        { onConflict: "cart_id,product_id" },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    },
  );

  // FR-2.3.2 — สินค้าเดิม 3 + เพิ่ม 2 = quantity 5
  it("บวก quantity ใหม่เข้ากับจำนวนเดิมของสินค้าในตะกร้า", async () => {
    setup(product, [{ product, quantity: 3 }]);

    await addCartItem(makeRequest(2), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      {
        cart_id: "cart-1",
        product_id: "product-1",
        quantity: 5,
      },
      { onConflict: "cart_id,product_id" },
    );
  });

  // AC-9: cart line ที่น้ำหนักรวมเกิน 20,000 กรัมเพิ่มได้; จำกัดน้ำหนักตอน checkout
  it("อนุญาตให้เพิ่มสินค้าแม้น้ำหนักรวมตะกร้าเกินขีดจำกัดจัดส่ง", async () => {
    const heavyProduct = { ...product, weight_gram: 8_000 };
    setup(heavyProduct, []);

    await addCartItem(makeRequest(3), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      {
        cart_id: "cart-1",
        product_id: "product-1",
        quantity: 3,
      },
      { onConflict: "cart_id,product_id" },
    );
  });

  // FR-2.4.1 — BVA: จำนวนรวมเท่ากับ 10 ยังผ่าน
  it("ยอมรับเมื่อ quantity รวมหลังเพิ่มเท่ากับ 10", async () => {
    setup(product, [{ product, quantity: 8 }]);

    await addCartItem(makeRequest(2), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 10 }),
      { onConflict: "cart_id,product_id" },
    );
  });

  // BVA — ตรวจค่าด้านในใกล้ขอบบนของ quantity รวม
  it("ยอมรับเมื่อ quantity รวมหลังเพิ่มเป็น 9", async () => {
    setup(product, [{ product, quantity: 8 }]);

    await addCartItem(makeRequest(1), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 9 }),
      { onConflict: "cart_id,product_id" },
    );
  });

  // AC-2 / FR-2.4.1 — จำนวนรวม 8 + 3 = 11 ต้องไม่เขียนทับค่าเดิม
  it("AC-2: ปฏิเสธเมื่อ quantity รวมเกิน 10 และไม่เปลี่ยนตะกร้า", async () => {
    const p1 = { ...product, id: "P1" };
    setup(p1, [{ product: p1, quantity: 8 }]);

    await expect(
      addCartItem(makeRequest(3, "P1"), makeResponse()),
    ).rejects.toMatchObject({
      code: "QTY_OUT_OF_RANGE",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.4.2 — BVA: เพิ่มได้พอดีกับ stock
  it("ยอมรับเมื่อ quantity รวมเท่ากับ stock พร้อมขาย", async () => {
    const p2 = { ...product, id: "P2", available_stock: 3 };
    setup(p2, [{ product: p2, quantity: 2 }]);

    await addCartItem(makeRequest(1, "P2"), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: "P2",
        quantity: 3,
      }),
      { onConflict: "cart_id,product_id" },
    );
  });

  // BVA — quantity รวมหนึ่งหน่วยต่ำกว่า stock ก็ผ่าน
  it("ยอมรับเมื่อ quantity รวมต่ำกว่า stock หนึ่งหน่วย", async () => {
    const p2 = { ...product, id: "P2", available_stock: 4 };
    setup(p2, [{ product: p2, quantity: 2 }]);

    await addCartItem(makeRequest(1, "P2"), makeResponse());

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: "P2", quantity: 3 }),
      { onConflict: "cart_id,product_id" },
    );
  });

  // AC-3 / FR-2.4.2 — 2 + 2 = 4 ไม่เกิน 10 แต่เกิน stock 3
  it("AC-3: ปฏิเสธเมื่อ quantity รวมเกิน stock และไม่เปลี่ยนตะกร้า", async () => {
    const p2 = { ...product, id: "P2", available_stock: 3 };
    setup(p2, [{ product: p2, quantity: 2 }]);

    await expect(
      addCartItem(makeRequest(2, "P2"), makeResponse()),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });
});

function makeUpdateRequest(productId: string, quantity: unknown): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
    params: { id: productId },
    body: { quantity },
  } as unknown as Request;
}

// ---------- updateCartItem ----------
describe("updateCartItem ตาม FR-2.5 และ FR-2.6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FR-2.5.1 / FR-2.6 ข้อ 1
  it("ปฏิเสธ quantity ที่ไม่ใช่จำนวนเต็มก่อนตรวจตะกร้า", async () => {
    setup(product, []);

    await expect(
      updateCartItem(makeUpdateRequest("product-1", 1.5), makeResponse()),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.5.2 / FR-2.6 ข้อ 2
  // ต้องตอบ QTY_OUT_OF_RANGE ก่อน ITEM_NOT_IN_CART; ไม่กำหนดว่าห้ามอ่านตะกร้า
  it.each([0, 11])(
    "ปฏิเสธ quantity %i ก่อนตรวจว่าสินค้าอยู่ในตะกร้าหรือไม่",
    async (quantity) => {
      setup(product, []);

      await expect(
        updateCartItem(
          makeUpdateRequest("product-1", quantity),
          makeResponse(),
        ),
      ).rejects.toMatchObject({
        code: "QTY_OUT_OF_RANGE",
      });

      expect(query.upsert).not.toHaveBeenCalled();
    },
  );

  // FR-2.5.3 — quantity ถูกช่วง แต่ไม่มีสินค้าในตะกร้า
  it("แจ้ง ITEM_NOT_IN_CART เมื่อไม่พบรายการสินค้าในตะกร้า", async () => {
    setup(product, []);

    await expect(
      updateCartItem(makeUpdateRequest("product-1", 2), makeResponse()),
    ).rejects.toMatchObject({
      code: "ITEM_NOT_IN_CART",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.5.4 — ตรวจสถานะหลังยืนยันว่ารายการอยู่ในตะกร้าแล้ว
  it("แจ้ง PRODUCT_UNAVAILABLE เมื่อสินค้าในตะกร้าไม่พร้อมขาย", async () => {
    const unavailableProduct = { ...product, status: "ปิดขาย" };
    setup(unavailableProduct, [
      { product: unavailableProduct, quantity: 2 },
    ]);

    await expect(
      updateCartItem(makeUpdateRequest("product-1", 3), makeResponse()),
    ).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.5.5 — quantity ใหม่เกิน stock
  it("แจ้ง INSUFFICIENT_STOCK เมื่อ quantity ใหม่เกิน stock", async () => {
    const lowStockProduct = { ...product, available_stock: 3 };
    setup(lowStockProduct, [
      { product: lowStockProduct, quantity: 2 },
    ]);

    await expect(
      updateCartItem(makeUpdateRequest("product-1", 4), makeResponse()),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });

    expect(query.upsert).not.toHaveBeenCalled();
  });

  // FR-2.5.6 / BVA — quantity ใหม่แทนค่าเดิม ทั้งขอบเขตและค่าด้านใน
  it.each([1, 2, 9, 10])(
    "แทน quantity เดิมด้วยค่าใหม่ %i",
    async (quantity) => {
      setup(product, [{ product, quantity: 2 }]);

      const res = makeResponse();
      await updateCartItem(makeUpdateRequest("product-1", quantity), res);

      expect(query.upsert).toHaveBeenCalledWith(
        {
          cart_id: "cart-1",
          product_id: "product-1",
          quantity,
        },
        { onConflict: "cart_id,product_id" },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    },
  );
});

// ---------- removeCartItem ----------
describe("removeCartItem ตาม FR-2.7 และ FR-0.7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ปฏิเสธด้วย CART_EMPTY เมื่อไม่มีรายการในตะกร้า", async () => {
    setup(product, []);
    query.select.mockResolvedValue({ data: [], error: null });

    await expect(
      removeCartItem(makeRemoveRequest("P1"), makeResponse()),
    ).rejects.toMatchObject({
      code: "CART_EMPTY",
      message: "ไม่มีสินค้าให้ลบ",
    });

    expect(query.delete).not.toHaveBeenCalled();
  });

  it("ปฏิเสธด้วย ITEM_NOT_IN_CART เมื่อมีสินค้าอื่นแต่ไม่มีสินค้าที่ระบุ", async () => {
    const p2 = { ...product, id: "P2" };
    setup(product, [{ product: p2, quantity: 1 }]);
    query.select.mockResolvedValue({ data: [], error: null });

    await expect(
      removeCartItem(makeRemoveRequest("P1"), makeResponse()),
    ).rejects.toMatchObject({
      code: "ITEM_NOT_IN_CART",
      message: "ไม่พบสินค้าในตะกร้า",
    });

    expect(query.delete).not.toHaveBeenCalled();
  });

  it("ลบรายการได้แม้สินค้าจะปิดขาย และแสดงตะกร้าว่างเมื่อลบรายการสุดท้าย", async () => {
    const p1 = { ...product, id: "P1", status: "ปิดขาย" };
    setup(p1, [{ product: p1, quantity: 2 }]);

    const emptyCart = { items: [], totalQuantity: 0 };
    vi.mocked(buildCartSummary).mockResolvedValue(emptyCart as any);
    query.select.mockResolvedValue({
      data: [{ product_id: "P1" }],
      error: null,
    });

    const res = makeResponse();
    await removeCartItem(makeRemoveRequest("P1"), res);

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenNthCalledWith(1, "cart_id", "cart-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "product_id", "P1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "ตะกร้าว่าง",
      cart: emptyCart,
    });
  });

  // ECP: หลังลบแล้วยังมีรายการอื่น ต้องไม่รายงานว่าตะกร้าว่าง
  it("ลบเฉพาะรายการที่ระบุเมื่อยังมีสินค้าอื่นในตะกร้า", async () => {
    const p1 = { ...product, id: "P1" };
    const p2 = { ...product, id: "P2" };
    setup(p1, [
      { product: p1, quantity: 1 },
      { product: p2, quantity: 2 },
    ]);
    const remainingCart = { items: [{ productId: "P2", quantity: 2 }] };
    vi.mocked(buildCartSummary).mockResolvedValue(remainingCart as any);
    query.select.mockResolvedValue({
      data: [{ product_id: "P1" }],
      error: null,
    });

    const res = makeResponse();
    await removeCartItem(makeRemoveRequest("P1"), res);

    expect(query.delete).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: "Item removed from cart",
      cart: remainingCart,
    });
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: "ตะกร้าว่าง" }),
    );
  });
});

function makeCouponRequest(code: unknown): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
    body: { code },
  } as unknown as Request;
}

// ---------- applyCoupon ----------
describe("applyCoupon ตาม FR-3.1 ถึง FR-3.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ใช้ code แบบตรงตัวอักษร; code ที่ไม่พบหรือ case ไม่ตรงได้ COUPON_INVALID", async () => {
    setup(product, [{ product, quantity: 1 }]);
    vi.mocked(findCoupon).mockResolvedValue(null);

    await expect(
      applyCoupon(makeCouponRequest("save10"), makeResponse()),
    ).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });

    expect(findCoupon).toHaveBeenCalledWith("save10");
    expect(setCartCoupon).not.toHaveBeenCalled();
  });

  it("ปฏิเสธคูปองที่ปิดใช้ด้วย COUPON_INVALID", async () => {
    setup(product, [{ product, quantity: 1 }]);
    vi.mocked(findCoupon).mockResolvedValue({
      code: "SAVE10",
      status: "ปิดใช้",
      min_spend: 0,
    } as any);

    await expect(
      applyCoupon(makeCouponRequest("SAVE10"), makeResponse()),
    ).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });

    expect(setCartCoupon).not.toHaveBeenCalled();
  });

  it("ผูกคูปองที่เปิดใช้แม้ยอดซื้อยังไม่ถึง min_spend", async () => {
    setup(product, [{ product, quantity: 1 }]);

    const coupon = {
      code: "SAVE10",
      status: "เปิดใช้",
      min_spend: 1000,
      percent: 10,
    };
    vi.mocked(findCoupon).mockResolvedValue(coupon as any);
    vi.mocked(setCartCoupon).mockResolvedValue(undefined);
    const summary = { coupon: { code: "SAVE10" }, subtotal: 100 };
    vi.mocked(buildCartSummary).mockResolvedValue(summary as any);

    const res = makeResponse();
    await applyCoupon(makeCouponRequest("SAVE10"), res);

    expect(setCartCoupon).toHaveBeenCalledWith("cart-1", "SAVE10");
    expect(buildCartSummary).toHaveBeenCalledWith(cart);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Coupon applied",
      cart: summary,
    });
  });

  it("ผูกคูปองได้แม้ตะกร้าว่าง", async () => {
    setup(product, []);

    const coupon = {
      code: "SAVE10",
      status: "เปิดใช้",
      min_spend: 1000,
      percent: 10,
    };
    vi.mocked(findCoupon).mockResolvedValue(coupon as any);
    vi.mocked(setCartCoupon).mockResolvedValue(undefined);
    const summary = { items: [], coupon: { code: "SAVE10" }, subtotal: 0 };
    vi.mocked(buildCartSummary).mockResolvedValue(summary as any);

    const res = makeResponse();
    await applyCoupon(makeCouponRequest("SAVE10"), res);

    expect(setCartCoupon).toHaveBeenCalledWith("cart-1", "SAVE10");
    expect(buildCartSummary).toHaveBeenCalledWith(cart);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("แทนคูปองเดิมด้วยคูปองใหม่", async () => {
    const cartWithOldCoupon = { ...cart, applied_coupon_code: "OLD10" };
    setup(product, [{ product, quantity: 1 }]);
    vi.mocked(getOrCreateCart).mockResolvedValue(cartWithOldCoupon as any);
    vi.mocked(findCoupon).mockResolvedValue({
      code: "SAVE10",
      status: "เปิดใช้",
      min_spend: 0,
      percent: 10,
    } as any);
    vi.mocked(setCartCoupon).mockResolvedValue(undefined);

    await applyCoupon(makeCouponRequest("SAVE10"), makeResponse());

    expect(setCartCoupon).toHaveBeenCalledWith("cart-1", "SAVE10");
    expect(cartWithOldCoupon.applied_coupon_code).toBe("SAVE10");
  });
});

function makeViewCartRequest(): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
  } as unknown as Request;
}

// ---------- viewCart ----------
describe("viewCart ตาม FR-2.9", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ส่ง cart summary กลับตามข้อมูลที่สร้างไว้", async () => {
    const summary = {
      cartId: "cart-1",
      items: [
        {
          productId: "P1",
          name: "Book",
          price: 100,
          quantity: 2,
          status: "เปิดขาย",
          availableStock: 5,
        },
      ],
      subtotal: 200,
      coupon: { code: "SAVE10", percent: 10, minSpend: 100 },
    };

    setup(product, []);
    vi.mocked(buildCartSummary).mockResolvedValue(summary as any);

    const res = makeResponse();
    await viewCart(makeViewCartRequest(), res);

    expect(res.json).toHaveBeenCalledWith({ cart: summary });
  });

  it("viewCart ไม่เปลี่ยน stage ของผู้ใช้ (FR-8.5.2, FR-1.2.3)", async () => {
    setup(product, []);

    await viewCart(makeViewCartRequest(), makeResponse());

    expect(query.update).not.toHaveBeenCalled();
  });
});

// ---------- continueShopping ----------
// OP-12 แยกออกจาก viewCart เป็น POST /cart/continue (route ตรวจ stage สำเร็จ)
describe("continueShopping ตาม FR-6.4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.eq
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(Promise.resolve({ data: null, error: null }));
  });

  it("เมื่อกลับมาซื้อต่อ ให้เปลี่ยน stage สำเร็จเป็นตะกร้าและส่งตะกร้าว่าง", async () => {
    const emptySummary = {
      cartId: "cart-1",
      items: [],
      totalQuantity: 0,
      subtotal: 0,
      coupon: null,
    };

    setup(product, []);
    vi.mocked(buildCartSummary).mockResolvedValue(emptySummary as any);

    const res = makeResponse();
    await continueShopping(makeViewCartRequest(), res);

    expect(query.update).toHaveBeenCalledWith({
      current_stage: "ตะกร้า",
      current_order_id: null,
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "user-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "current_stage", "สำเร็จ");
    expect(res.json).toHaveBeenCalledWith({ cart: emptySummary });
  });
});
