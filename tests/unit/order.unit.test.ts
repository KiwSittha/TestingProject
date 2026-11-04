import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ORDER_STATUS, USER_STAGE } from "../../src/config/business";
import { supabase } from "../../src/config/supabase";
import {
  getCartLines,
  getOrCreateCart,
  resolveCartCoupon,
  setCartCoupon,
} from "../../src/services/cart.service";
import {
  cancelOrder,
  checkout,
  listOrders,
  pay,
  viewOrder,
} from "../../src/controllers/order.controller";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("../../src/config/supabase", () => ({
  supabase: { from },
}));

vi.mock("../../src/services/cart.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/cart.service")>();

  return {
    ...actual,
    getCartLines: vi.fn(),
    getOrCreateCart: vi.fn(),
    resolveCartCoupon: vi.fn(),
    setCartCoupon: vi.fn(),
  };
});

function makeQuery(result: unknown): any {
  const query: any = {};
  const chainMethods = [
    "select",
    "eq",
    "order",
    "limit",
    "insert",
    "upsert",
    "update",
    "delete",
    "in",
    "single",
    "maybeSingle",
    "returns",
  ];

  for (const method of chainMethods) {
    query[method] = vi.fn(() => query);
  }

  // Supabase query builders are awaitable even when the chain ends with .eq().
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);

  return query;
}

function mockDatabase(...results: unknown[]) {
  const queries = results.map(makeQuery);
  let index = 0;
  (supabase.from as any).mockImplementation(() => queries[index++]);
  return queries;
}

function makeRequest(
  body: Record<string, unknown> = {},
  id?: string,
): Request {
  return {
    user: {
      userId: "user-1",
      username: "cus_normal",
      role: "Customer",
    },
    params: id ? { id } : {},
    body,
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

const cart = { id: "cart-1", applied_coupon_code: null };
const product = {
  id: "P1",
  name: "Book",
  price: 100,
  weight_gram: 100,
  available_stock: 5,
  status: "เปิดขาย",
};

// ---------- checkout ----------
describe("checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ปฏิเสธ zone ที่ไม่รองรับด้วย VALIDATION_ERROR", async () => {
    const res = makeResponse();

    await expect(
      checkout(makeRequest({ zone: "unknown", speed: "standard" }), res),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ECP: zone ใช้ได้ แต่ speed อยู่ในกลุ่มค่าที่ไม่รองรับ
  it("ปฏิเสธ speed ที่ไม่รองรับด้วย VALIDATION_ERROR", async () => {
    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "overnight" }), makeResponse()),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ECP: ตะกร้าว่าง
  it("ปฏิเสธ checkout ด้วย CART_EMPTY เมื่อตะกร้าว่าง", async () => {
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([] as any);

    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "standard" }), makeResponse()),
    ).rejects.toMatchObject({ code: "CART_EMPTY" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ECP: สินค้าในตะกร้าปิดขาย ต้องรายงาน productId ที่ไม่พร้อมขาย
  it("ปฏิเสธ checkout เมื่อมีสินค้าไม่พร้อมขาย", async () => {
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      { product: { ...product, status: "ปิดขาย" }, quantity: 1 },
    ] as any);

    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "standard" }), makeResponse()),
    ).rejects.toMatchObject({ code: "ITEMS_UNAVAILABLE" });

    // ปฏิเสธก่อนสร้าง order
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ECP: สินค้าพร้อมขายแต่ quantity ในตะกร้าเกิน stock ก็ checkout ไม่ได้
  it("ปฏิเสธ checkout เมื่อ quantity เกิน stock พร้อมขาย", async () => {
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      { product: { ...product, available_stock: 1 }, quantity: 2 },
    ] as any);

    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "standard" }), makeResponse()),
    ).rejects.toMatchObject({ code: "ITEMS_UNAVAILABLE" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // FSM / BVA: order ใหม่เริ่มที่รอชำระ และน้ำหนักเท่าขีดจำกัด 20,000 กรัมผ่านได้
  it("สร้าง order พร้อม snapshot รายการและเปลี่ยน stage เป็นชำระเงิน", async () => {
    const order = {
      id: "ORD-1",
      user_id: "user-1",
      status: ORDER_STATUS.PENDING_PAYMENT,
      subtotal: 200,
      discount: 0,
      shipping_fee: 80,
      net_total: 280,
      zone: "inCity",
      speed: "standard",
      coupon_code: null,
    };
    const items = [
      {
        id: "line-1",
        order_id: "ORD-1",
        product_id: "P1",
        product_name: "Book",
        unit_price: 100,
        quantity: 2,
      },
    ];
    const queries = mockDatabase(
      { data: { member_tier: "normal" }, error: null },
      { data: order, error: null },
      { data: items, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    const boundaryProduct = { ...product, weight_gram: 10_000 };
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      { product: boundaryProduct, quantity: 2 },
    ] as any);
    vi.mocked(resolveCartCoupon).mockResolvedValue({ coupon: null, removed: false });

    const res = makeResponse();
    await checkout(makeRequest({ zone: "inCity", speed: "standard" }), res);

    expect(queries[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        status: ORDER_STATUS.PENDING_PAYMENT,
        subtotal: 200,
        shipping_fee: 80,
        net_total: 280,
      }),
    );
    expect(queries[2].insert).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: "ORD-1",
        product_id: "P1",
        unit_price: 100,
        quantity: 2,
      }),
    ]);
    expect(queries[3].update).toHaveBeenCalledWith(
      expect.objectContaining({ available_stock: 3 }),
    );
    expect(queries[4].update).toHaveBeenCalledWith({
      current_stage: USER_STAGE.PAYMENT,
      current_order_id: "ORD-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Order created, awaiting payment",
      order: { ...order, items },
    });
  });

  // BVA: น้ำหนักรวมหนึ่งกรัมเกินขีดจำกัดต้องปฏิเสธก่อนสร้าง order
  it("ปฏิเสธเมื่อน้ำหนักรวมเป็น 20,001 กรัม", async () => {
    const overweightProduct = { ...product, weight_gram: 20_001 };
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      { product: overweightProduct, quantity: 1 },
    ] as any);

    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "standard" }), makeResponse()),
    ).rejects.toMatchObject({ code: "WEIGHT_LIMIT_EXCEEDED" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // FR-5.2.1 ลำดับตรวจ: สินค้าไม่พร้อมขายต้องมาก่อนตรวจน้ำหนัก
  it("รายงาน ITEMS_UNAVAILABLE ก่อน WEIGHT_LIMIT_EXCEEDED", async () => {
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      {
        product: { ...product, status: "ปิดขาย", weight_gram: 20_001 },
        quantity: 1,
      },
    ] as any);

    await expect(
      checkout(makeRequest({ zone: "inCity", speed: "standard" }), makeResponse()),
    ).rejects.toMatchObject({ code: "ITEMS_UNAVAILABLE" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  // AC-4 ถึง AC-8: ECP สำหรับ member tier/coupon และค่าจัดส่งตาม weight tier
  it.each([
    {
      ac: "AC-4",
      price: 1650,
      weight: 1200,
      tier: "prime",
      zone: "inCity",
      speed: "standard",
      coupon: { code: "SAVE10", status: "เปิดใช้", percent: 10, min_spend: 0 },
      removed: false,
      discount: 165,
      shipping: 0,
      net: 1485,
    },
    {
      ac: "AC-5",
      price: 1650,
      weight: 1200,
      tier: "prime",
      zone: "inCity",
      speed: "standard",
      coupon: null,
      removed: false,
      discount: 82,
      shipping: 0,
      net: 1568,
    },
    {
      ac: "AC-6",
      price: 900,
      weight: 600,
      tier: "prime",
      zone: "upcountry",
      speed: "express",
      coupon: null,
      removed: true,
      discount: 45,
      shipping: 25,
      net: 880,
    },
    {
      ac: "AC-7",
      price: 1200,
      weight: 900,
      tier: "normal",
      zone: "inCity",
      speed: "standard",
      coupon: null,
      removed: true,
      discount: 0,
      shipping: 30,
      net: 1230,
    },
    {
      ac: "AC-8",
      price: 15000,
      weight: 8000,
      tier: "normal",
      zone: "remote",
      speed: "express",
      coupon: null,
      removed: false,
      discount: 0,
      shipping: 270,
      net: 15270,
    },
  ])("คำนวณยอดตาม $ac", async (scenario) => {
    const checkoutOrder = { id: "ORD-AC", user_id: "user-1" };
    const queries = mockDatabase(
      { data: { member_tier: scenario.tier }, error: null },
      { data: checkoutOrder, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    );
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(getCartLines).mockResolvedValue([
      {
        product: {
          ...product,
          price: scenario.price,
          weight_gram: scenario.weight,
          available_stock: 5,
        },
        quantity: 1,
      },
    ] as any);
    vi.mocked(resolveCartCoupon).mockResolvedValue({
      coupon: scenario.coupon as any,
      removed: scenario.removed,
    });

    const res = makeResponse();
    await checkout(makeRequest({ zone: scenario.zone, speed: scenario.speed }), res);

    expect(queries[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: scenario.price,
        discount: scenario.discount,
        shipping_fee: scenario.shipping,
        net_total: scenario.net,
      }),
    );
    if (scenario.removed) {
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ notice: "คูปองไม่สามารถใช้กับคำสั่งซื้อนี้" }),
      );
    }
  });
});

// ---------- pay ----------
describe("pay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ปฏิเสธ result ที่ไม่ใช่ success หรือ fail", async () => {
    const res = makeResponse();

    await expect(
      pay(makeRequest({ orderId: "ORD-1", result: "unknown" }, "ORD-1"), res),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("แจ้ง ORDER_NOT_FOUND เมื่อไม่พบ order ของผู้เรียก", async () => {
    mockDatabase({ data: null, error: null });

    await expect(
      pay(makeRequest({ orderId: "ORD-404", result: "success" }, "ORD-404"), makeResponse()),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });

  // ECP: พบ order แต่สถานะไม่ใช่ pending payment
  it("ปฏิเสธการจ่าย order ที่ไม่ได้รอชำระ", async () => {
    mockDatabase({
      data: {
        id: "ORD-1",
        user_id: "user-1",
        status: ORDER_STATUS.PAID,
      },
      error: null,
    });

    await expect(
      pay(makeRequest({ orderId: "ORD-1", result: "success" }, "ORD-1"), makeResponse()),
    ).rejects.toMatchObject({ code: "OPERATION_NOT_ALLOWED" });
  });

  it("ประมวลผล pay success และล้างตะกร้ากับคูปอง", async () => {
    const pendingOrder = {
      id: "ORD-1",
      user_id: "user-1",
      status: ORDER_STATUS.PENDING_PAYMENT,
    };
    const orderItems = [
      { order_id: "ORD-1", product_id: "P1", quantity: 2 },
    ];
    const paidOrder = { ...pendingOrder, status: ORDER_STATUS.PAID };
    const queries = mockDatabase(
      { data: pendingOrder, error: null },
      { data: orderItems, error: null },
      { data: paidOrder, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );
    vi.mocked(getOrCreateCart).mockResolvedValue(cart as any);
    vi.mocked(setCartCoupon).mockResolvedValue(undefined);

    const res = makeResponse();
    await pay(
      makeRequest({ orderId: "ORD-1", result: "success" }, "ORD-1"),
      res,
    );

    expect(queries[2].update).toHaveBeenCalledWith(
      expect.objectContaining({ status: ORDER_STATUS.PAID }),
    );
    expect(queries[3].delete).toHaveBeenCalled();
    expect(setCartCoupon).toHaveBeenCalledWith("cart-1", null);
    expect(queries[4].update).toHaveBeenCalledWith({
      current_stage: USER_STAGE.COMPLETED,
      current_order_id: "ORD-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "ชำระเงินสำเร็จ",
      order: { ...paidOrder, items: orderItems },
    });
  });

  // ECP / FSM: fail เป็นค่าที่ถูกต้อง แต่ต้องคงสถานะตาม FR-6.2.2
  it("เมื่อ pay fail ต้องคง order และ stage เดิม", async () => {
    const pendingOrder = {
      id: "ORD-1",
      user_id: "user-1",
      status: ORDER_STATUS.PENDING_PAYMENT,
    };
    const [query] = mockDatabase({ data: pendingOrder, error: null });

    const res = makeResponse();
    await pay(makeRequest({ orderId: "ORD-1", result: "fail" }, "ORD-1"), res);

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(query.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: "การชำระเงินล้มเหลว กรุณาลองใหม่",
      order: pendingOrder,
    });
  });
});

// ---------- cancelOrder ----------
describe("cancelOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("แจ้ง ORDER_NOT_FOUND เมื่อไม่พบ order ของผู้เรียก", async () => {
    mockDatabase({ data: null, error: null });

    await expect(
      cancelOrder(makeRequest({}, "ORD-404"), makeResponse()),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });

  it("ยกเลิก order ที่รอชำระและคืน stage เป็นตะกร้า", async () => {
    const pendingOrder = {
      id: "ORD-1",
      user_id: "user-1",
      status: ORDER_STATUS.PENDING_PAYMENT,
      coupon_code: "SAVE10",
    };
    const cancelledOrder = { ...pendingOrder, status: ORDER_STATUS.CANCELLED };
    const orderItems = [
      { order_id: "ORD-1", product_id: "P1", quantity: 2 },
    ];
    const queries = mockDatabase(
      { data: pendingOrder, error: null },
      { data: orderItems, error: null },
      { data: [product], error: null },
      { data: null, error: null },
      { data: cancelledOrder, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );
    vi.mocked(getOrCreateCart).mockResolvedValue(
      { ...cart, applied_coupon_code: "SAVE10" } as any,
    );
    vi.mocked(setCartCoupon).mockResolvedValue(undefined);

    const res = makeResponse();
    await cancelOrder(makeRequest({}, "ORD-1"), res);

    expect(queries[3].update).toHaveBeenCalledWith(
      expect.objectContaining({ available_stock: 7 }),
    );
    expect(queries[4].update).toHaveBeenCalledWith(
      expect.objectContaining({ status: ORDER_STATUS.CANCELLED }),
    );
    expect(queries[5].upsert).toHaveBeenCalledWith(
      [{ cart_id: "cart-1", product_id: "P1", quantity: 2 }],
      { onConflict: "cart_id,product_id" },
    );
    expect(setCartCoupon).toHaveBeenCalledWith("cart-1", "SAVE10");
    expect(queries[6].update).toHaveBeenCalledWith({
      current_stage: USER_STAGE.CART,
      current_order_id: null,
    });
    // FR-7.1.2/.3 และ AC-12: คืน stock และรายการเดิมกลับตะกร้า
    expect(supabase.from).toHaveBeenCalledWith("products");
    expect(supabase.from).toHaveBeenCalledWith("cart_items");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Checkout cancelled",
      order: cancelledOrder,
    });
  });

  // ECP/FSM: order ที่ไม่ได้รอชำระต้องไม่เข้าสู่ transition ยกเลิก
  it("ปฏิเสธการยกเลิก order ที่ไม่ได้รอชำระ", async () => {
    const paidOrder = {
      id: "ORD-1",
      user_id: "user-1",
      status: ORDER_STATUS.PAID,
    };
    const [query] = mockDatabase({ data: paidOrder, error: null });

    await expect(
      cancelOrder(makeRequest({}, "ORD-1"), makeResponse()),
    ).rejects.toMatchObject({ code: "OPERATION_NOT_ALLOWED" });

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(query.update).not.toHaveBeenCalled();
  });
});

// ---------- listOrders ----------
describe("listOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("แสดงเฉพาะ order ของผู้เรียกและเรียงจากใหม่ไปเก่า", async () => {
    const orders = [{ id: "ORD-2" }, { id: "ORD-1" }];
    const [query] = mockDatabase({ data: orders, error: null });

    const res = makeResponse();
    await listOrders(makeRequest(), res);

    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ orders });
  });

  // ECP: ไม่มี order ของผู้เรียก
  it("ส่งรายการว่างเมื่อผู้เรียกยังไม่มี order", async () => {
    const [query] = mockDatabase({ data: [], error: null });

    const res = makeResponse();
    await listOrders(makeRequest(), res);

    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(res.json).toHaveBeenCalledWith({ orders: [] });
  });
});

// ---------- viewOrder ----------
describe("viewOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ส่ง order พร้อมรายการของ order กลับมา", async () => {
    const order = { id: "ORD-1", user_id: "user-1" };
    const items = [{ order_id: "ORD-1", product_id: "P1", quantity: 2 }];
    const queries = mockDatabase(
      { data: order, error: null },
      { data: items, error: null },
    );

    const res = makeResponse();
    await viewOrder(makeRequest({}, "ORD-1"), res);

    expect(queries[0].eq).toHaveBeenNthCalledWith(1, "id", "ORD-1");
    expect(queries[0].eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      order: { ...order, items },
    });
  });

  it("แจ้ง ORDER_NOT_FOUND เมื่อ order ไม่มีอยู่หรือเป็นของคนอื่น", async () => {
    mockDatabase({ data: null, error: null });

    await expect(
      viewOrder(makeRequest({}, "ORD-404"), makeResponse()),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });
  });

  // ECP: order มีอยู่แต่เป็นของ Customer คนอื่น ต้องได้ผลเหมือนไม่พบ
  it("ซ่อน order ของ Customer คนอื่นด้วย ORDER_NOT_FOUND", async () => {
    const [query] = mockDatabase({ data: null, error: null });

    await expect(
      viewOrder(makeRequest({}, "ORD-OTHER"), makeResponse()),
    ).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "ORD-OTHER");
    expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", "user-1");
  });
});
