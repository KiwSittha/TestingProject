import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { COUPON_STATUS, PRODUCT_STATUS, USER_STAGE } from "../config/business";
import { dbCheck } from "../utils/errors";

// ผู้ใช้ที่ชุดเทสใช้ (เพิ่ม id ได้ถ้ามี user ทดสอบคนอื่น) — reset แตะเฉพาะ user เหล่านี้
const TEST_USER_IDS = ["cus_normal", "cus_prime"];

// ค่าตั้งต้นของข้อมูลทดสอบ ตรงกับ PRODUCTS ใน e2e/helpers.ts
const BASELINE_PRODUCTS = [
  { id: "P1", price: 450, available_stock: 20 },
  { id: "P2", price: 1200, available_stock: 3 },
  { id: "P3", price: 15000, available_stock: 5 }
];
const BASELINE_COUPON_CODE = "SAVE10";

// POST /test/reset — ตั้งข้อมูลกลับเป็นค่าตั้งต้น (เทียบเท่าการสร้าง db.json ใหม่ในสไลด์)
// ลงทะเบียนเฉพาะ non-production (ดู server.ts)
export async function resetTestData(_req: Request, res: Response) {
  const now = new Date().toISOString();

  // 1) ผู้ใช้กลับไปขั้น "ตะกร้า" และไม่อ้าง order ใด (ทำก่อนลบ order เผื่อมี foreign key)
  dbCheck(
    await supabase
      .from("users")
      .update({ current_stage: USER_STAGE.CART, current_order_id: null })
      .in("id", TEST_USER_IDS),
    "Reset user stage"
  );

  // 2) ลบ order และรายการสินค้าใน order ของ user ทดสอบ
  const orders = dbCheck(
    await supabase
      .from("orders")
      .select("id")
      .in("user_id", TEST_USER_IDS)
      .returns<{ id: string }[]>(),
    "Load test orders"
  );
  const orderIds = orders.map((o) => o.id);

  if (orderIds.length > 0) {
    dbCheck(
      await supabase.from("order_items").delete().in("order_id", orderIds),
      "Delete order items"
    );
    dbCheck(await supabase.from("orders").delete().in("id", orderIds), "Delete orders");
  }

  // 3) ล้างตะกร้าและถอดคูปองที่ผูกไว้
  const carts = dbCheck(
    await supabase
      .from("carts")
      .select("id")
      .in("user_id", TEST_USER_IDS)
      .returns<{ id: string }[]>(),
    "Load test carts"
  );
  const cartIds = carts.map((c) => c.id);

  if (cartIds.length > 0) {
    dbCheck(
      await supabase.from("cart_items").delete().in("cart_id", cartIds),
      "Clear cart items"
    );
    dbCheck(
      await supabase
        .from("carts")
        .update({ applied_coupon_code: null, updated_at: now })
        .in("id", cartIds),
      "Clear cart coupon"
    );
  }

  // 4) สินค้ากลับเป็นราคา/สต็อก/สถานะตั้งต้น
  for (const p of BASELINE_PRODUCTS) {
    dbCheck(
      await supabase
        .from("products")
        .update({
          price: p.price,
          available_stock: p.available_stock,
          status: PRODUCT_STATUS.ON_SALE,
          updated_at: now
        })
        .eq("id", p.id),
      `Reset product ${p.id}`
    );
  }

  // 5) คูปองกลับเป็น "เปิดใช้"
  dbCheck(
    await supabase
      .from("coupons")
      .update({ status: COUPON_STATUS.ACTIVE })
      .eq("code", BASELINE_COUPON_CODE),
    "Reset coupon"
  );

  res.status(200).json({ message: "reset สำเร็จ" });
}