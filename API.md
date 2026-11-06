# API Reference

Base URL: `http://localhost:3000`  ·  รัน: `npm run dev`

ทุก endpoint ยกเว้น `/login` ต้องส่ง header `Authorization: Bearer <accessToken>`

Error ทุกตัวตอบเป็น `{ "code": "...", "message": "..." }` (บางตัวมี field เพิ่ม เช่น `availableStock`)

| OP | Method | Path | Role | Body |
|----|--------|------|------|------|
| OP-1 login | POST | `/login` | ทุกบทบาท | `{ username, password }` |
| (หน้าเว็บ) ผู้ใช้ปัจจุบัน | GET | `/me` | ทุกบทบาท | – คืน `{ user, stage, orderId }` (`stage` เป็น `null` สำหรับ Admin) |
| OP-2 listProducts | GET | `/list` | ทุกบทบาท | – |
| OP-3 addItem | POST | `/cart/items` | Customer | `{ productId: string, quantity: number }` |
| OP-4 updateQuantity | PATCH | `/cart/items/:productId` | Customer | `{ productId?, quantity: number }` |
| OP-5 removeItem | DELETE | `/cart/items/:productId` | Customer | `{ productId? }` |
| OP-6 applyCoupon | PUT | `/cart/items` | Customer | `{ code: string }` |
| OP-7 ViewCart | GET | `/cart` | Customer | – (ดูอย่างเดียว ไม่เปลี่ยน stage) |
| OP-8 pressCheckout | POST | `/orders/new/payment` | Customer | `{ zone, speed }` |
| OP-9 cancelCheckout | POST | `/orders/:orderId/cancel` | Customer | – |
| OP-10 paySuccess | POST | `/orders/:orderId/payment` | Customer | `{ orderId, result: "success" }` |
| OP-11 payFail | POST | `/orders/:orderId/payment` | Customer | `{ orderId, result: "fail" }` |
| OP-12 continueShopping | POST | `/cart/continue` | Customer | – (เฉพาะ stage `สำเร็จ`) |
| OP-13 listOrders | GET | `/orders` | Customer | – |
| OP-14 viewOrder | GET | `/orders/:orderId` | Customer | – |
| OP-15 updateProduct | PATCH | `/admin/products/:productId/update` | Admin | `{ productId?, price?: number, stock?: number }` |
| OP-16 setProductStatus | PATCH | `/admin/products/:productId/set` | Admin | `{ productId?, status: "เปิดขาย" \| "ปิดขาย" }` |
| OP-17 setCouponStatus | PATCH | `/admin/coupons/:code/set` | Admin | `{ code?, status: 1 \| 0 }` (1 = เปิดใช้, 0 = ปิดใช้) |
| OP-18 listCoupons | GET | `/admin/coupons` | Admin | – |

`?` = ไม่บังคับ ถ้าส่งมาต้องตรงกับ id ใน path

## หมายเหตุการออกแบบ

- **OP-8 / OP-10 / OP-11 ใช้ path เดียวกัน** แยกด้วย body: มี `result` = จ่ายเงิน, ไม่มี = checkout (`:id` ตอน checkout ใช้ `new` เพราะยังไม่มีเลข order)
- **zone / speed** ใช้ `inCity` / `upcountry` / `remote` และ `standard` / `express`; ค่าส่งคำนวณตามน้ำหนักรวมและระดับสมาชิกตาม FR-4.5–4.7
- **คูปอง (FR-4.3.1)**: ถ้ายอดต่ำกว่า `min_spend` หรือคูปองถูกปิด จะถอดคูปองออกจากตะกร้าตอน checkout
  - การผูกคูปองไม่ตรวจยอดขั้นต่ำ (FR-3.2.2)
  - `GET /cart` และคำสั่งแก้ตะกร้าไม่ถอดคูปอง ส่วนลดที่แสดงในตะกร้าเป็นค่าประมาณ
  - checkout ประเมินคูปอง (FR-5.2.2) ถ้าใช้ไม่ได้จะถอดออกและตอบ `notice` พร้อมออเดอร์
- จำนวนต่อสินค้า 1–10 (รวมของเดิมในตะกร้า), น้ำหนักรวม ≤ 20,000 กรัม
- จอง stock ตอน checkout; คงการจองไว้เมื่อชำระเงินล้มเหลว, คืน stock และรายการกลับตะกร้าเมื่อยกเลิก
- `payFail` คงสถานะออเดอร์และ stage เดิม เพื่อให้ลองชำระเงินซ้ำได้
- ดู order ที่ไม่มีอยู่ หรือเป็นของคนอื่น → 404 `ORDER_NOT_FOUND` เหมือนกัน
- สถานะ order: `รอชำระเงิน` → `ชำระเงินแล้ว` / `ยกเลิก`
