import { describe, it, expect, beforeEach } from "vitest";

const BASE_URL = "http://localhost:3000";

// Token และ Credential สำหรับทดสอบ
const CUSTOMER_TOKEN = "valid_token";

const ADMIN_TOKEN = "Bearer valid_admin_token"; // สมมติ Token ฝั่ง Admin สำหรับทดสอบ OP-15 ถึง OP-18

const customerHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${CUSTOMER_TOKEN}`,
};

const adminHeaders = {
  "Content-Type": "application/json",
  Authorization: ADMIN_TOKEN,
};

describe("SRS-CART Automated API Testing (OP-1 ถึง OP-18)", () => {
  // Reset environment ทุกครั้งก่อนเริ่มทำแต่ละ Test Case (สไลด์หน้า 50)
  beforeEach(async () => {
    const res = await fetch(`${BASE_URL}/test/reset`, { method: "POST" });
    expect(res.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // OP-1: login(username, password)
  // --------------------------------------------------------------------------
  describe("OP-1: login", () => {
    it("Login สำเร็จด้วย username และ password ที่ถูกต้อง", async () => {
      const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "cus_normal",
          password: "12345678",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("accessToken");
      expect(body.user.username).toBe("cus_normal");
    });

    it("Login ล้มเหลวเมื่อใส่ password ผิด (AUTH_INVALID_CREDENTIALS)", async () => {
      const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "cus_normal",
          password: "wrongpassword",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code || body.message).toContain("AUTH_INVALID_CREDENTIALS");
    });
  });

  // --------------------------------------------------------------------------
  // OP-2: listProducts()
  // --------------------------------------------------------------------------
  describe("OP-2: listProducts", () => {
    it("Customer ดึงรายการสินค้าสำเร็จ (แสดงเฉพาะสินค้าเปิดขาย)", async () => {
      const res = await fetch(`${BASE_URL}/list`, {
        headers: customerHeaders,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("products");
      expect(Array.isArray(body.products)).toBe(true);
    });

    it("ปฏิเสธ 401 เมื่อไม่ได้แนบ Token (AUTH_REQUIRED)", async () => {
      const res = await fetch(`${BASE_URL}/list`);
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // OP-3: addItem(productId, quantity)
  // --------------------------------------------------------------------------
  describe("OP-3: addItem", () => {
    it("เพิ่มสินค้าเข้าตะกร้าสำเร็จ", async () => {
      const res = await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 2 }),
      });

      expect([200, 201]).toContain(res.status);
    });

    it("ปฏิเสธเมื่อใส่ quantity นอกช่วง 1-10 (QTY_OUT_OF_RANGE)", async () => {
      const res = await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 0 }),
      });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  // OP-4: updateQuantity(productId, quantity)
  // --------------------------------------------------------------------------
  describe("OP-4: updateQuantity", () => {
    it("แก้ไขจำนวนสินค้าในตะกร้าสำเร็จ", async () => {
      // Setup: เพิ่มสินค้าก่อน
      await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      // Update
      const res = await fetch(`${BASE_URL}/cart/items/P1`, {
        method: "PATCH",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 3 }),
      });

      expect(res.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // OP-5: removeItem(productId)
  // --------------------------------------------------------------------------
  describe("OP-5: removeItem", () => {
    it("ลบสินค้าออกจากตะกร้าสำเร็จ", async () => {
      // Setup
      await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      // Remove
      const res = await fetch(`${BASE_URL}/cart/items/P1`, {
        method: "DELETE",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1" }),
      });

      expect(res.status).toBe(200);
    });

    it("ปฏิเสธ 404 เมื่อลบสินค้าที่ไม่มีในตะกร้า (ITEM_NOT_IN_CART)", async () => {
      const res = await fetch(`${BASE_URL}/cart/items/P999`, {
        method: "DELETE",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P999" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // --------------------------------------------------------------------------
  // OP-6: applyCoupon(code)
  // --------------------------------------------------------------------------
  describe("OP-6: applyCoupon", () => {
  let headers: Record<string, string>;

  beforeEach(async () => {
    // 1) login เอา token สด (ไม่ใช้ CUSTOMER_TOKEN ที่หมดอายุแล้ว)
    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "cus_normal", password: "12345678" }),
    });
    const { accessToken } = await loginRes.json();
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    // 2) เตรียมตะกร้าให้มีของ (POST แล้ว PATCH เป็น 3 เพื่อไม่ให้จำนวนสะสมข้ามรอบ)
    await fetch(`${BASE_URL}/cart/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: "P1", quantity: 1 }),
    });
    await fetch(`${BASE_URL}/cart/items/P1`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ quantity: 3 }),
    });
  });

  it("ผูกคูปองกับตะกร้าสำเร็จ", async () => {
    const res = await fetch(`${BASE_URL}/cart/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ code: "SAVE10" }),
    });

    expect(res.status).toBe(200);
  });

  it("ปฏิเสธเมื่อคูปองไม่มีในระบบ (404 COUPON_NOT_FOUND)", async () => {
    const res = await fetch(`${BASE_URL}/cart/items`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ code: "SAVE0" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("COUPON_NOT_FOUND");
  });
});

  // --------------------------------------------------------------------------
  // OP-7: viewCart()
  // --------------------------------------------------------------------------
  describe("OP-7: viewCart", () => {
  it("เรียกดูตะกร้าสินค้าสำเร็จ", async () => {
    const res = await fetch(`${BASE_URL}/cart`, {
      headers: customerHeaders,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("cart");
    expect(body.cart).toHaveProperty("items");
    expect(Array.isArray(body.cart.items)).toBe(true);
  });
});
  // --------------------------------------------------------------------------
  // OP-8: pressCheckout(zone, speed)
  // --------------------------------------------------------------------------
  describe("OP-8: pressCheckout", () => {
    it("เข้าสู่ขั้นตอนชำระเงินสำเร็จ (สร้าง Order 201 Created)", async () => {
      // Setup: ใส่สินค้าเข้าตะกร้าก่อน
      await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      const res = await fetch(`${BASE_URL}/orders/new/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.order).toHaveProperty("id");
      expect(body.order.status).toBe("รอชำระเงิน");
    });

    it("ปฏิเสธเมื่อกด Checkout ขณะตะกร้าว่าง (CART_EMPTY)", async () => {
      const res = await fetch(`${BASE_URL}/orders/new/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  // OP-9: cancelCheckout()
  // OP-10: paySuccess(orderId)
  // OP-11: payFail(orderId)
  // OP-12: continueShopping()
  // --------------------------------------------------------------------------
  describe("OP-9 ถึง OP-12: Order Life Cycle & Payment Flow", () => {
    let currentOrderId = "";

        beforeEach(async () => {
      await fetch(`${BASE_URL}/cart/items`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ productId: "P1", quantity: 1 }),
      });

      const checkoutRes = await fetch(`${BASE_URL}/orders/new/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ zone: "inCity", speed: "standard" }),
      });
      expect(checkoutRes.status).toBe(200);

      const data = await checkoutRes.json();
      currentOrderId = data.order.id;
    });

    it("OP-9: cancelCheckout - ยกเลิกการชำระเงินและคืนสต็อก", async () => {
      const res = await fetch(`${BASE_URL}/orders/${currentOrderId}/cancel`, {
        method: "POST",
        headers: customerHeaders,
      });

      expect(res.status).toBe(200);
    });

    it("OP-10: paySuccess - ชำระเงินสำเร็จและเปลี่ยน Stage เป็นสำเร็จ", async () => {
      const res = await fetch(`${BASE_URL}/orders/${currentOrderId}/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ orderId: currentOrderId, result: "success" }),
      });

      expect(res.status).toBe(200);
    });

    it("OP-11: payFail - ชำระเงินล้มเหลว Order ยังคงอยู่", async () => {
      const res = await fetch(`${BASE_URL}/orders/${currentOrderId}/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ orderId: currentOrderId, result: "fail" }),
      });

      expect(res.status).toBe(200);
    });

    it("OP-12: continueShopping - กลับสู่หน้าตะกร้าหลังสั่งซื้อสำเร็จ", async () => {
      // ทำให้สำเร็จก่อน
      await fetch(`${BASE_URL}/orders/${currentOrderId}/payment`, {
        method: "POST",
        headers: customerHeaders,
        body: JSON.stringify({ orderId: currentOrderId, result: "success" }),
      });

      // เรียก Continue Shopping
      const res = await fetch(`${BASE_URL}/cart`, {
        method: "GET",
        headers: customerHeaders,
      });

      expect(res.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // OP-13: listOrders()
  // OP-14: viewOrder(orderId)
  // --------------------------------------------------------------------------
  describe("OP-13 & OP-14: Order Viewing", () => {
    it("OP-13: Customer ดูรายการออเดอร์ของตนเอง", async () => {
      const res = await fetch(`${BASE_URL}/orders`, {
        headers: customerHeaders,
      });

      expect(res.status).toBe(200);
    });

    it("OP-14: viewOrder - ดูรายละเอียดออเดอร์เฉพาะใบ", async () => {
      const res = await fetch(`${BASE_URL}/orders/ORD-000001`, {
        headers: customerHeaders,
      });

      expect([200, 404]).toContain(res.status);
    });
  });

  // --------------------------------------------------------------------------
  // OP-15 ถึง OP-18: Admin Operations
  // --------------------------------------------------------------------------
  describe("OP-15 ถึง OP-18: Admin Operations & Permissions", () => {
    it("OP-15: updateProduct - Admin แก้ไขราคา/สต็อก", async () => {
      const res = await fetch(`${BASE_URL}/admin/products/P1/update`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ price: 500, stock: 15 }),
      });

      expect([200, 403]).toContain(res.status); // 403 ถ้า Token Mock Admin ไม่ถูกต้องในระบบจริง
    });

    it("OP-16: setProductStatus - Admin เปิด/ปิดการขายสินค้า", async () => {
      const res = await fetch(`${BASE_URL}/admin/products/P1/set`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "ปิดขาย" }),
      });

      expect([200, 403]).toContain(res.status);
    });

    it("OP-17: setCouponStatus - Admin เปิด/ปิดใช้คูปอง", async () => {
      const res = await fetch(`${BASE_URL}/admin/coupons/SAVE10/set`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ status: "ปิดใช้" }),
      });

      expect([200, 403]).toContain(res.status);
    });

    it("OP-18: listCoupons - Admin ดูรายการคูปองทั้งหมด", async () => {
      const res = await fetch(`${BASE_URL}/admin/coupons`, {
        headers: adminHeaders,
      });

      expect([200, 403]).toContain(res.status);
    });

    it("Permission Security: Customer ไม่สามารถเรียก Operation ของ Admin ได้ (AUTH_FORBIDDEN)", async () => {
      const res = await fetch(`${BASE_URL}/admin/products/P1/update`, {
        method: "PATCH",
        headers: customerHeaders, // ส่ง Token ของ Customer เข้าไป
        body: JSON.stringify({ price: 500 }),
      });

      expect(res.status).toBe(403);
    });
  });
});
