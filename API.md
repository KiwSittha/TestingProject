# API Reference

Base URL: `http://localhost:3000`  ·  รัน: `npm run dev`

ทุก endpoint ยกเว้น `/login` ต้องส่ง header `Authorization: Bearer <accessToken>`

Error ทุกตัวตอบเป็น `{ "code": "...", "message": "..." }` (บางตัวมี field เพิ่ม เช่น `availableStock`)

| OP | Method | Path | Role | Body |
|----|--------|------|------|------|
| OP-1 login | POST | `/login` | ทุกบทบาท | `{ username, password }` |
| OP-2 listProducts | GET | `/list` | ทุกบทบาท | – |
| OP-3 addItem | POST | `/cart/items` | Customer | `{ productId: string, quantity: number }` |
| OP-4 updateQuantity | PATCH | `/cart/items/:productId` | Customer | `{ productId?, quantity: number }` |
| OP-5 removeItem | DELETE | `/cart/items/:productId` | Customer | `{ productId? }` |
| OP-6 applyCoupon | PUT | `/cart/items` | Customer | `{ code: string }` |
| OP-7 ViewCart / OP-12 continueShopping | GET | `/cart` | Customer | – |
| OP-8 pressCheckout | POST | `/orders/new/payment` | Customer | `{ zone, speed }` |
| OP-9 cancelCheckout | POST | `/orders/:orderId/cancel` | Customer | – |
| OP-10 paySuccess | POST | `/orders/:orderId/payment` | Customer | `{ orderId, result: "success" }` |
| OP-11 payFail | POST | `/orders/:orderId/payment` | Customer | `{ orderId, result: "fail" }` |
| OP-13 listOrders | GET | `/orders` | Customer | – |
| OP-14 viewOrder | GET | `/orders/:orderId` | Customer | – |
| OP-15 updateProduct | PATCH | `/admin/products/:productId/update` | Admin | `{ productId?, price?: number, stock?: number }` |
| OP-16 setProductStatus | PATCH | `/admin/products/:productId/set` | Admin | `{ productId?, status: "เปิดขาย" \| "ปิดขาย" }` |
| OP-17 setCouponStatus | PATCH | `/admin/coupons/:code/set` | Admin | `{ code?, status: 1 \| 0 }` (1 = เปิดใช้, 0 = ปิดใช้) |
| OP-18 listCoupons | GET | `/admin/coupons` | Admin | – |

`?` = ไม่บังคับ ถ้าส่งมาต้องตรงกับ id ใน path

## หมายเหตุการออกแบบ

- **OP-8 / OP-10 / OP-11 ใช้ path เดียวกัน** แยกด้วย body: มี `result` = จ่ายเงิน, ไม่มี = checkout (`:id` ตอน checkout ใช้ `new` เพราะยังไม่มีเลข order)
- **zone / speed** และค่าส่งอยู่ใน `src/config/business.ts` (`SHIPPING_FEE`) ตอนนี้: `bangkok` / `upcountry` × `standard` / `express`
- **คูปอง (FR-4.3.1)**: ถ้ายอดต่ำกว่า `min_spend` หรือคูปองถูกปิด จะถอดคูปองออกจากตะกร้าอัตโนมัติ
  - `PUT /cart/items` → 400 `COUPON_NOT_APPLICABLE`
  - `GET /cart` และ cart response อื่น ๆ → 200 พร้อม `cart.notice`
  - checkout → 400 `COUPON_NOT_APPLICABLE`
- จำนวนต่อสินค้า 1–10 (รวมของเดิมในตะกร้า), น้ำหนักรวม ≤ 20,000 กรัม
- ตัด stock ตอน `paySuccess` เท่านั้น แล้วลบสินค้าที่ซื้อออกจากตะกร้า
- ดู order ที่ไม่มีอยู่ หรือเป็นของคนอื่น → 404 `ORDER_NOT_FOUND` เหมือนกัน
- สถานะ order: `รอชำระเงิน` → `ชำระเงินสำเร็จ` / `ชำระเงินไม่สำเร็จ` / `ยกเลิก`
