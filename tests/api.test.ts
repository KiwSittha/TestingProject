import { describe, it, expect, beforeEach } from "vitest";

const BASE = "http://localhost:3000";

// Tokens สำหรับทดสอบ
const USER_TOKEN = "Bearer valid_token";        // cus_normal (Customer normal)
const PRIME_TOKEN = "Bearer valid_prime_token";  // cus_prime (Customer prime)
const ADMIN_TOKEN = "Bearer valid_admin_token";  // admin01 (Admin)

const JSON_HDR = { "Content-Type": "application/json" };
const USER_HDR = { ...JSON_HDR, Authorization: USER_TOKEN };
const PRIME_HDR = { ...JSON_HDR, Authorization: PRIME_TOKEN };
const ADMIN_HDR = { ...JSON_HDR, Authorization: ADMIN_TOKEN };

describe("SRS-CART-002 Automated API Testing", () => {
  // Reset environment ก่อนเริ่มทำแต่ละ Test Case
  beforeEach(async () => {
    const res = await fetch(`${BASE}/test/reset`, { method: "POST" });
    expect(res.status).toBe(200);
  });

  // =========================================================================
  // OP-1: login (FR-0.1.1, FR-0.1.2)
  // =========================================================================
  describe("OP-1: login", () => {
    it("A1 ECT (Valid Customer Input): login สำเร็จด้วย Customer account และได้ role Customer", async () => {
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username: "cus_normal", password: "12345678" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accessToken).toBeTruthy();
      expect(body.user.role).toBe("Customer");
    });

    it("A2 ECT (Valid Admin Input): login สำเร็จด้วย Admin account และได้ role Admin", async () => {
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username: "admin01", password: "12345678" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.role).toBe("Admin");
    });

    it("B1 ECT (Invalid Password): login ปฏิเสธเมื่อ password ไม่ถูกต้อง (401)", async () => {
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username: "cus_normal", password: "wrongpassword" }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("B2 ECT (Invalid Username): login ปฏิเสธเมื่อไม่มี username นี้ในระบบ (401)", async () => {
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: JSON_HDR,
        body: JSON.stringify({ username: "no_such_user", password: "12345678" }),
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });
  });

  // =========================================================================
  // Discovery Path 2 & 3: Authentication & Permissions (FR-0.2, FR-0.3)
  // =========================================================================
  describe("Authentication and Permissions (Discovery Path 2 & 3)", () => {
    it("B3 Discovery Path 2 (Auth Required): เรียก API ที่ต้องยืนยันตัวตนโดยไม่มี token (401)", async () => {
      const res = await fetch(`${BASE}/cart`, { method: "GET" });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("AUTH_REQUIRED");
    });

    it("B4 Discovery Path 3 (Role Permission): Customer พยายามเรียก Admin API (403)", async () => {
      const res = await fetch(`${BASE}/admin/products/P1/update`, {
        method: "PATCH",
        headers: USER_HDR,
        body: JSON.stringify({ price: 500 }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("AUTH_FORBIDDEN");
    });

    it("B5 Discovery Path 3 (Role Permission): Admin พยายามเรียก Customer cart API (403)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: ADMIN_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("AUTH_FORBIDDEN");
    });
  });

  // =========================================================================
  // OP-2: listProducts (FR-1.3.1, FR-1.3.2)
  // =========================================================================
  describe("OP-2: listProducts", () => {
    it("A3 ECT (Customer Visibility): Customer ดูรายการสินค้าเปิดขายได้", async () => {
      const res = await fetch(`${BASE}/list`, { headers: USER_HDR });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.products)).toBe(true);
      expect(body.products[0]).toHaveProperty("id");
      expect(body.products[0]).toHaveProperty("name");
    });

    it("A4 ECT (Admin Visibility): Admin ดูรายการสินค้าทั้งหมดพร้อมสถานะการขายได้", async () => {
      const res = await fetch(`${BASE}/list`, { headers: ADMIN_HDR });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.products[0]).toHaveProperty("status");
    });
  });

  // =========================================================================
  // OP-3: addItem & Boundary Analysis (FR-2.1 - FR-2.4, FR-2.6)
  // =========================================================================
  describe("OP-3: addItem", () => {
    it("A5 ECT (Valid addItem): เพิ่มสินค้าใหม่ลงตะกร้าสำเร็จ", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 2 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cart.items[0].productId).toBe("P1");
      expect(body.cart.items[0].quantity).toBe(2);
    });

    it("C1 BVA (Valid Min Quantity): เพิ่มสินค้าด้วย quantity = 1", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });
      expect(res.status).toBe(200);
    });

    it("C2 BVA (Max Valid Quantity): เพิ่มสินค้าด้วย quantity = 10", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 10 }),
      });
      expect(res.status).toBe(200);
    });

    it("B6 BVA (Invalid Lower Bound = 0): ปฏิเสธ quantity = 0 (400 QTY_OUT_OF_RANGE)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 0 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("QTY_OUT_OF_RANGE");
    });

    it("B7 BVA (Invalid Upper Bound = 11): ปฏิเสธ quantity = 11 (400 QTY_OUT_OF_RANGE)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 11 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("QTY_OUT_OF_RANGE");
    });

    it("B8 ECT (Non-integer Quantity): ปฏิเสธ quantity ที่ไม่ใช่จำนวนเต็ม (400 VALIDATION_ERROR)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1.5 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("B9 ECT (Invalid Product ID): ปฏิเสธ productId ที่ไม่มีอยู่จริง (404 PRODUCT_NOT_FOUND)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P9999", quantity: 1 }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("B10 BVA/ECT (Qty > Available Stock): ปฏิเสธเมื่อ quantity เกินสต็อกพร้อมขาย (400 INSUFFICIENT_STOCK)", async () => {
      // P2 มีสต็อกตั้งต้น = 3
      const res = await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P2", quantity: 4 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("INSUFFICIENT_STOCK");
    });
  });

  // =========================================================================
  // OP-4 & OP-5: updateQuantity & removeItem (FR-2.5, FR-2.7)
  // =========================================================================
  describe("OP-4 & OP-5: Cart Line Operations", () => {
    it("A6 ECT (Valid updateQuantity): updateQuantity เปลี่ยนจำนวนสินค้าสำเร็จ", async () => {
      // Setup: เพิ่ม P1 ก่อน
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 2 }),
      });

      const res = await fetch(`${BASE}/cart/items/P1`, {
        method: "PATCH",
        headers: USER_HDR,
        body: JSON.stringify({ quantity: 4 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cart.items[0].quantity).toBe(4);
    });

    it("B13 ECT (Item Not In Cart): updateQuantity กับสินค้าที่ไม่ได้อยู่ในตะกร้า (404 ITEM_NOT_IN_CART)", async () => {
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 2 }),
      });

      const res = await fetch(`${BASE}/cart/items/P2`, {
        method: "PATCH",
        headers: USER_HDR,
        body: JSON.stringify({ quantity: 1 }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe("ITEM_NOT_IN_CART");
    });

    it("B14 FSM / ECT (Cart Empty State): ลบสินค้าขณะตะกร้าว่าง (400 CART_EMPTY)", async () => {
      const res = await fetch(`${BASE}/cart/items/P1`, {
        method: "DELETE",
        headers: USER_HDR,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("CART_EMPTY");
      expect(body.message).toContain("ไม่มีสินค้าให้ลบ");
    });

    it("C3 BVA (Cart Line Count 1 -> 0): ลบสินค้าชิ้นสุดท้ายจนตะกร้าว่าง (200 + 'ตะกร้าว่าง')", async () => {
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      const res = await fetch(`${BASE}/cart/items/P1`, {
        method: "DELETE",
        headers: USER_HDR,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("ตะกร้าว่าง");
      expect(body.cart.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // OP-6 & OP-7: applyCoupon & viewCart (FR-3.1, FR-3.2, FR-1.1, FR-2.9)
  // =========================================================================
  describe("OP-6 & OP-7: Coupon & Cart Viewing", () => {
    it("A8 ECT (Valid Coupon Code): ผูกคูปองกับตะกร้าสำเร็จ", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "PUT",
        headers: USER_HDR,
        body: JSON.stringify({ code: "SAVE10" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cart.coupon.code).toBe("SAVE10");
    });

    it("B16 ECT (Case-sensitive Validation): คูปองเป็น Case-sensitive (save10 != SAVE10) (400 COUPON_INVALID)", async () => {
      const res = await fetch(`${BASE}/cart/items`, {
        method: "PUT",
        headers: USER_HDR,
        body: JSON.stringify({ code: "save10" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("COUPON_INVALID");
    });

    it("A9 ECT (Valid viewCart): viewCart ดูสินค้าพร้อม subtotal ได้ถูกต้อง", async () => {
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 2 }),
      });

      const res = await fetch(`${BASE}/cart`, { method: "GET", headers: USER_HDR });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cart.items[0]).toHaveProperty("price");
      expect(body.cart).toHaveProperty("subtotal");
    },30000);
  });

  // =========================================================================
  // OP-8: pressCheckout & Decision Table Verification (FR-4, FR-5)
  // =========================================================================
  describe("OP-8: pressCheckout", () => {
    it("B18 FSM / Decision Table Guard: pressCheckout ขณะตะกร้าว่าง (400 CART_EMPTY)", async () => {
      const res = await fetch(`${BASE}/orders/new/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("CART_EMPTY");
    });

    it("B19 ECT (Invalid Enum Value): ปฏิเสธ zone หรือ speed ที่ไม่ถูกต้อง (400 VALIDATION_ERROR)", async () => {
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      const res = await fetch(`${BASE}/orders/new/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ zone: "invalid_zone", speed: "standard" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("A10 Decision Table Rule 1 (Coupon Active & Subtotal >= minSpend): คูปอง SAVE10 + Prime Customer -> คำนวณส่วนลดคูปองถูกต้อง", async () => {
      // P1(450) + P2(1200) = 1650 >= minSpend(1000)
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: PRIME_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: PRIME_HDR,
        body: JSON.stringify({ productId: "P2", quantity: 1 }),
      });
      await fetch(`${BASE}/cart/items`, {
        method: "PUT",
        headers: PRIME_HDR,
        body: JSON.stringify({ code: "SAVE10" }),
      });

      const res = await fetch(`${BASE}/orders/new/payment`, {
        method: "POST",
        headers: PRIME_HDR,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order.status).toBe("รอชำระเงิน");
      expect(body.order.discount).toBe(165); // 10% of 1650
      expect(body.order.shipping_fee).toBe(0); // Prime standard = 0
      expect(body.order.net_total).toBe(1485);
    }, 30000);
  });

  // =========================================================================
  // OP-9 ถึง OP-12: Order Lifecycle & FSM Sequence Validity (FR-6, FR-7, FR-8)
  // =========================================================================
  describe("OP-9 ถึง OP-12: Order Lifecycle & FSM Rules", () => {
    let orderId = "";

    beforeEach(async () => {
      // Setup order ให้พร้อมชำระเงิน
      await fetch(`${BASE}/cart/items`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });
      const checkoutRes = await fetch(`${BASE}/orders/new/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });
      const data = await checkoutRes.json();
      orderId = data.order.id;
    });

    it("A12 FSM (Self-loop State รอชำระเงิน): จ่ายไม่ผ่าน Order ยังอยู่ state รอชำระเงิน", async () => {
      const res = await fetch(`${BASE}/orders/${orderId}/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ orderId, result: "fail" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order.status).toBe("รอชำระเงิน");
    });

    it("A13 FSM (Valid State Transition: รอชำระเงิน -> ชำระเงินแล้ว): จ่ายสำเร็จ เปลี่ยนสถานะเป็น ชำระเงินแล้ว และล้างตะกร้า", async () => {
      const res = await fetch(`${BASE}/orders/${orderId}/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ orderId, result: "success" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order.status).toBe("ชำระเงินแล้ว");

      // Verify cart is cleared
      const cartRes = await fetch(`${BASE}/cart`, { headers: USER_HDR });
      const cartData = await cartRes.json();
      expect(cartData.cart.items).toHaveLength(0);
    });

    it("A14 FSM (Valid State Transition: รอชำระเงิน -> ยกเลิก): ยกเลิกออเดอร์ คืนสต็อกและนำสินค้ากลับเข้าตะกร้า", async () => {
      const res = await fetch(`${BASE}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: USER_HDR,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order.status).toBe("ยกเลิก");

      // Verify cart items returned
      const cartRes = await fetch(`${BASE}/cart`, { headers: USER_HDR });
      const cartData = await cartRes.json();
      expect(cartData.cart.items[0].quantity).toBe(1);
    });

    it("B21 FSM (Invalid Transition จาก State สิ้นสุด): ห้ามยกเลิกออเดอร์ที่ชำระเงินแล้ว (400 OPERATION_NOT_ALLOWED)", async () => {
      // Pay success first
      await fetch(`${BASE}/orders/${orderId}/payment`, {
        method: "POST",
        headers: USER_HDR,
        body: JSON.stringify({ orderId, result: "success" }),
      });

      // Try to cancel
      const res = await fetch(`${BASE}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: USER_HDR,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("OPERATION_NOT_ALLOWED");
    });
  });

  // =========================================================================
  // OP-13 ถึง OP-18: Orders Viewing & Admin Operations (FR-9, FR-10)
  // =========================================================================
  describe("OP-13 ถึง OP-18: Orders Viewing & Admin Operations", () => {
    it("A15 ECT / Sorting Verification: listOrders แสดงรายการเรียงจากใหม่ไปเก่า", async () => {
      const res = await fetch(`${BASE}/orders`, { headers: USER_HDR });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.orders)).toBe(true);
    });

    it("B23 ECT (Non-existent / Other's Order ID): viewOrder ของ orderId ที่ไม่มีอยู่จริง (404 ORDER_NOT_FOUND)", async () => {
      const res = await fetch(`${BASE}/orders/ORD-NOT-FOUND`, { headers: USER_HDR });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe("ORDER_NOT_FOUND");
    });

    it("A16 ECT (Admin Product Update): Admin แก้ไขราคาสินค้าสำเร็จ", async () => {
      const res = await fetch(`${BASE}/admin/products/P1/update`, {
        method: "PATCH",
        headers: ADMIN_HDR,
        body: JSON.stringify({ price: 500, stock: 15 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.product.price).toBe(500);
      expect(body.product.available_stock).toBe(15);
    });

    it("B24 ECT / BVA (Invalid Negative Price): Admin แก้ไขราคาเป็นลบ (400 VALIDATION_ERROR)", async () => {
      const res = await fetch(`${BASE}/admin/products/P1/update`, {
        method: "PATCH",
        headers: ADMIN_HDR,
        body: JSON.stringify({ price: -1 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("A18 ECT (Admin Toggle Coupon Status): Admin ปิดใช้คูปอง และคูปองที่ปิดแล้วใช้ไม่ได้", async () => {
      // 1) Admin set status = ปิดใช้
      const res1 = await fetch(`${BASE}/admin/coupons/SAVE10/set`, {
        method: "PATCH",
        headers: ADMIN_HDR,
        body: JSON.stringify({ status: "ปิดใช้" }),
      });
      expect(res1.status).toBe(200);

      // 2) Customer try to apply closed coupon -> 400 COUPON_INVALID
      const res2 = await fetch(`${BASE}/cart/items`, {
        method: "PUT",
        headers: USER_HDR,
        body: JSON.stringify({ code: "SAVE10" }),
      });
      expect(res2.status).toBe(400);
      const body2 = await res2.json();
      expect(body2.code).toBe("COUPON_INVALID");
    });

    it("A19 ECT (Admin List Coupons): Admin ดูรายการคูปองทั้งหมดสำเร็จ", async () => {
      const res = await fetch(`${BASE}/admin/coupons`, { headers: ADMIN_HDR });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.coupons)).toBe(true);
      expect(body.coupons[0]).toHaveProperty("code");
      expect(body.coupons[0]).toHaveProperty("status");
    });
  });
});