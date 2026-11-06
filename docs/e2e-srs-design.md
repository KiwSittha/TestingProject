# E2E Test Design ตาม SRS-CART-002 v1.8

ชุดเทส E2E ด้วย Playwright ที่เขียนจาก SRS-CART-002 v1.8 โดยตรง ค่าคาดหวังทุกค่ามาจาก spec ไม่ได้มาจากพฤติกรรมของโปรแกรม (ส่วนที่ 1.1)

| ไฟล์ | หน้าที่ |
|---|---|
| `e2e/srs/support/seed.ts` | ค่าจาก spec: seed data (ส่วนที่ 7), enum สถานะ, error code, ข้อความที่ FR กำหนด, URL (6.2.2) |
| `e2e/srs/support/api.ts` | reset ตาม DC-3.1 และการเตรียม Given ผ่าน API ตาม API.md |
| `e2e/srs/support/fixtures.ts` | `seedData` (reset อัตโนมัติก่อนทุกเทส), `loginAs` (เปิด browser context แยกต่อผู้ใช้), `given` |
| `e2e/srs/support/ui.ts` | locator จาก `data-testid` (6.2.1) และการตรวจค่าจาก attribute (DC-2.7–2.11) |
| `e2e/srs/01-auth.spec.ts` … `08-ac-guarded-actions.spec.ts` | test case E2E-01 ถึง E2E-39 ครอบ AC ครบ 23 ข้อ (ตาราง 4.9) |

## 1. หลักการออกแบบ

1. **E2E ทดสอบเส้นทางของผู้ใช้ผ่านหน้าเว็บ** ส่วนการคำนวณแบบครบทุก combination (ECT, BVA, Decision Table FR-4.2–4.4, pairwise FR-4.5–4.7) อยู่ที่ระดับ unit ของ pure function ใน DC-1 ที่ E2E ใช้ AC ของ spec เป็นตัวแทน เพื่อยืนยันว่าหน้าจอแสดงผลของ api-server ครบทุกส่วน
2. **ขั้น When ทำผ่านหน้าเว็บเสมอ ส่วนขั้น Given ที่ไม่ได้เป็นสิ่งที่ทดสอบ เตรียมผ่าน API** (`given(...)`) เช่น ใส่สินค้าในตะกร้าไว้ก่อน หรือให้ admin ปิดคูปองก่อนที่ลูกค้าจะ checkout วิธีนี้ทำให้เทสเร็ว และเมื่อเทสล้มจะรู้ได้ว่าล้มที่ขั้นที่ถูกทดสอบ ส่วน action ของ Admin ที่เป็นขั้น When (E2E-31 ถึง E2E-34) ทำผ่านหน้า Admin
3. **Isolation:** fixture `seedData` เรียก `POST /test/reset` (DC-3.1) ก่อนทุกเทส และผู้ใช้แต่ละคนใช้ browser context ของตัวเอง ถ้าเรียก `loginAs` ซ้ำกับบัญชีเดิม จะได้ context ใหม่ ซึ่งเท่ากับการ login ครั้งถัดไปของบัญชีเดียวกัน (FR-1.2)
4. **Locator:** ใช้ `getByTestId` ตามตาราง 6.2.1 เพราะ spec กำหนดชื่อไว้แล้ว ส่วนข้อความบนหน้าจอ ชื่อปุ่ม และ label เป็นสิ่งที่แต่ละกลุ่มออกแบบเอง จึงไม่ใช้เป็นสัญญาของเทส
5. **Assertion:** ตรวจจาก attribute ไม่ตรวจจากข้อความที่จัดรูปแบบแล้ว
   - จำนวนเงินและจำนวนชิ้นตรวจที่ `data-value`
   - สถานะตรวจที่ `data-status` โดยใช้ค่า enum ในส่วนที่ 2 เช่น `ชำระเงินแล้ว`
   - การพร้อมขายตรวจที่ `data-available`
   - ข้อความตรวจที่ `app-message` คู่กับ `data-kind` และ `data-code`
   - ปุ่มชำระเงินตรวจด้วย `toBeDisabled` หรือ `toBeEnabled`
   - หน้าปัจจุบันตรวจจาก testid ของหน้า
6. **Payment gateway:** กดปุ่ม `gateway-pay-success` หรือ `gateway-pay-fail` บน `page-checkout` (DC-3.3)
7. **`act()`:** กดปุ่มที่ส่งคำสั่งแล้วรอ response ของ request ที่ไม่ใช่ GET ก่อนไปขั้นถัดไป เพื่อไม่ให้ `page.goto` ยกเลิก request ที่ยังไม่เสร็จ helper นี้ไม่ผูกกับ path ของ API

## 2. วิธีรัน

```bash
npx playwright test e2e/srs                       # เฉพาะชุดนี้ ทุก browser ใน config
npx playwright test e2e/srs --project=chromium
npx playwright test e2e/srs/04-checkout-payment.spec.ts
npx playwright test e2e/srs --ui
npx playwright show-report
```

ไฟล์ `.env` ต้องมีค่าต่อไปนี้:

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `TEST_PASSWORD` | รหัสผ่านของ `cus_normal`, `cus_prime`, `admin01` |
| `TEST_PASSWORD_CUS_PRIME` (ไม่บังคับ) | ใช้เมื่อรหัสผ่านของบัญชีนี้ต่างจาก `TEST_PASSWORD` และตั้งแยกได้ทุกบัญชีในรูปแบบเดียวกัน |
| `API_URL` (ไม่บังคับ) | ค่าเริ่มต้นคือ `http://localhost:3000` ใช้กับ reset และการเตรียม Given |

`playwright.config.ts` ตั้ง `workers: 1` ไว้แล้ว ต้องคงค่านี้ไว้ เพราะทุกเทสใช้ database และบัญชีชุดเดียวกัน

## 3. สิ่งที่หน้าเว็บและ backend ต้องมีก่อนรัน

ชุดเทสนี้อาศัยสิ่งที่ spec บังคับไว้ในส่วนที่ 6 ทั้งหมด:

| ข้อกำหนด | สิ่งที่ต้องมี |
|---|---|
| DC-2.4–2.6, ตาราง 6.2.1 | `data-testid` ครบทุกตัวในตาราง รวมถึง testid ของหน้า (`page-*`) |
| DC-2.7, 2.9, 2.10, 2.11 | `data-value`, `data-status`, `data-available` และ `disabled` บนปุ่มชำระเงิน |
| DC-2.8 | element `app-message` ที่มี `data-kind` และ `data-code` |
| DC-2.12, ตาราง 6.2.2 | เปิดแต่ละหน้าด้วย URL ได้โดยตรง รวมถึงหน้า Admin |
| DC-2.13 | เปิด URL ที่ไม่ตรงกับ stage แล้วต้องแสดงหน้าของ stage ปัจจุบัน |
| DC-3.1 | `POST /test/reset` (มีอยู่แล้วใน `src/routes/test.routes.ts`) |
| DC-3.3 | ปุ่ม `gateway-pay-success` และ `gateway-pay-fail` บน `page-checkout` |

## 4. Test case

ทุกเทสเริ่มจาก seed data ตามส่วนที่ 7 (DC-3.1) Given ที่มีคำว่า "(API)" เตรียมผ่าน API ส่วนที่เหลือทำผ่านหน้าเว็บ

### 4.1 Login และเมนู (`01-auth.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-01 | FR-0.1.1, FR-0.3.2 | — | `cus_normal` login | เห็น `nav-products`, `nav-cart`, `nav-orders` และไม่มี `nav-admin-*` |
| E2E-02 | FR-0.1.1, FR-0.3.1 | — | `admin01` login | เห็น `nav-admin-products`, `nav-admin-coupons` และไม่มี `nav-cart`, `nav-orders` |
| E2E-03 | FR-0.1.2 | — | login `cus_normal` ด้วยรหัสผ่านผิด | ได้ `app-message` error `AUTH_INVALID_CREDENTIALS` ยังอยู่ที่ `page-login` |
| E2E-04 | FR-0.1.2 | — | login `no_such_user` | ผลเหมือน E2E-03 (ECT: username มีอยู่แต่รหัสผิด / username ไม่มีอยู่) |

### 4.2 สินค้าและตะกร้า (`02-products-cart.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-05 | FR-1.1, FR-2.8 | บัญชีที่ยังไม่เคยใช้งาน | เปิด `/cart` แล้วเปิด `/orders` | `cart-subtotal` = 0 ไม่มี `cart-line-*` ไม่มี SAVE10 ผูกอยู่ `checkout-button` disabled และไม่มี `order-row-*` |
| E2E-06 | FR-1.3.1 | — | เปิด `/products` จากนั้น admin ปิดขาย P2 (API) แล้วรีโหลด | ก่อนปิดขายเห็น P1–P3 พร้อมชื่อ ราคา และสต็อกตาม seed หลังปิดขายไม่มี `product-row-P2` |
| E2E-07 | FR-2.3.1, 2.3.2, 2.8, 2.9 | — | เพิ่ม P1 × 2 แล้วเพิ่ม P1 × 3 | ครั้งแรก qty 2, unit 450, available true, subtotal 900 และปุ่มเปิด ครั้งที่สอง qty 5, subtotal 2250 และยังเป็นแถวเดียว |
| E2E-08 | AC-2 | ตะกร้ามี P1 × 8 (API) | เพิ่ม P1 × 3 | error `QTY_OUT_OF_RANGE` และ P1 ยังเป็น 8 |
| E2E-09 | AC-3 | ตะกร้ามี P2 × 2 (API) | เพิ่ม P2 × 2 | error `INSUFFICIENT_STOCK` และ P2 ยังเป็น 2 |
| E2E-10 | FR-2.5.6 | ตะกร้ามี P1 × 2 (API) | แก้ quantity เป็น 4 | qty 4 และ subtotal 1800 |
| E2E-11 | FR-2.7.3, 2.7.4, 2.8 | ตะกร้ามี P1 × 1 และ P2 × 1 (API) | ลบ P2 แล้วลบ P1 | หลังลบ P2 subtotal 450 และปุ่มเปิด หลังลบ P1 ได้ info "ตะกร้าว่าง" (`data-code` ว่าง) subtotal 0 และปุ่มปิด |

### 4.3 คูปองและการคำนวณราคา (`03-coupon-pricing.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-12 | FR-3.1.1, 3.1.2, 3.2.1, 3.2.3 | ตะกร้าว่าง | ใช้คูปอง `save10` แล้วใช้ `SAVE10` | `save10` ได้ error `COUPON_INVALID` และไม่มีคูปองผูก `SAVE10` ผูกได้แม้ตะกร้าว่าง |
| E2E-13 | AC-4 | `cus_prime` เพิ่ม P1 และ P2 แล้วผูก SAVE10 ผ่านหน้าเว็บ | checkout inCity/standard | 1650 / 165 / 0 / 1485 |
| E2E-14 | AC-5 | `cus_prime` มี P1 + P2 ไม่มีคูปอง (API) | checkout inCity/standard | 1650 / 82 / 0 / 1568 |
| E2E-15 | AC-6, FR-7.2.2 | `cus_prime` มี P1 × 2 + SAVE10 (API) | checkout upcountry/express แล้วยกเลิก | ได้ notice `COUPON_NOT_APPLICABLE` และยอด 900 / 45 / 25 / 880 หลังยกเลิกไม่มีคูปองผูกกลับ |
| E2E-16 | AC-7, FR-10.1.3 | `cus_normal` มี P2 × 1 + SAVE10 และ admin ปิด SAVE10 (API) | เปิดตะกร้าแล้ว checkout inCity/standard | ก่อน checkout ยังเห็น SAVE10 ผูกอยู่ (soft) หลัง checkout ได้ notice `COUPON_NOT_APPLICABLE` และยอด 1200 / 0 / 30 / 1230 |
| E2E-17 | AC-8 | `cus_normal` มี P3 × 1 (API) | checkout remote/express | 15000 / 0 / 270 / 15270 |
| E2E-18 | AC-9 | `cus_normal` มี P3 × 3 (API) | checkout inCity/standard | error `WEIGHT_LIMIT_EXCEEDED` ยังอยู่ที่ `page-cart` P3 ยังเป็น 3 และปุ่มยังเปิด |

ยอดเงินในตารางเรียงเป็น subtotal / discount / shipping / total และตรวจที่ `checkout-*`

### 4.4 Checkout, การชำระเงิน และการยกเลิก (`04-checkout-payment.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-19 | AC-18a, AC-18b, FR-5.3, 6.1, 6.4, 0.5.1, 5.3.10 | — | เพิ่ม P1 × 1, checkout inCity/standard, pay success, continue shopping, เปิด `/orders` แล้ว `/products` | `page-checkout` แสดง 450 / 0 / 30 / 480 ส่วน `page-success` แสดง orderId เดิม `success-line-P1` และยอดเดียวกัน หลังกด continue ได้ตะกร้าว่างและปุ่มปิด ใน `/orders` ออเดอร์มีสถานะ `ชำระเงินแล้ว` total 480 และสต็อก P1 เป็น 19 |
| E2E-20 | FR-6.2.1, 6.2.2, 6.3 | `cus_normal` มี P1 × 2 (API) | checkout upcountry/express, pay fail 2 ครั้ง แล้ว pay success | ยอด 900 / 0 / 75 / 975 หลัง pay fail แต่ละครั้งได้ info "การชำระเงินล้มเหลว กรุณาลองใหม่" ยังอยู่ที่ `page-checkout` ด้วย orderId และยอดเดิม จากนั้น pay success ได้ `page-success` ของ orderId เดิม |
| E2E-21 | FR-7.1, 7.2.1, 7.3, AC-11a, AC-12 | `cus_normal` มี P2 × 3 + SAVE10 (API) | checkout inCity/standard → `cus_prime` ดูสินค้า → ยกเลิก → `cus_prime` รีโหลด → เปิด `/orders` → checkout ใหม่ | ยอด 3600 / 360 / 50 / 3290 ระหว่างที่ P2 ถูกจอง `cus_prime` ไม่เห็น P2 หลังยกเลิกตะกร้ามี P2 × 3 + SAVE10 และปุ่มเปิด P2 สต็อกกลับเป็น 3 ออเดอร์แรกมีสถานะ `ยกเลิก` และ orderId ใหม่ไม่ซ้ำกับเดิม |
| E2E-22 | AC-11b, AC-11c (ฝั่งหน้าเว็บ) | `cus_prime` มี P2 × 1 แล้ว `cus_normal` จอง P2 × 3 (API) | `cus_prime` เปิดตะกร้าแล้ว checkout | P2 แสดง `data-available="false"` และปุ่มเปิด กด checkout ได้ error `ITEMS_UNAVAILABLE` ยังอยู่ที่ `page-cart` P2 ยังเป็น 1 และ P2 ไม่แสดงใน `/products` |
| E2E-23 | AC-10, FR-9.3.4, 2.7.3 | `cus_normal` มี P1 × 1 และ admin ปิดขาย P1 (API) | เปิดตะกร้า checkout แล้วลบ P1 | P1 ยังอยู่โดยมี available false กด checkout ได้ error `ITEMS_UNAVAILABLE` และตะกร้าคงเดิม ลบ P1 ได้และได้ info "ตะกร้าว่าง" |

### 4.5 Stage และ URL (`05-stage-routing.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-24 | FR-1.2.1, 1.2.2 | — | เพิ่ม P1 × 1 ผูก SAVE10 ปิด context แล้ว login ใหม่ | ตะกร้ามี P1 × 1 และ SAVE10 |
| E2E-25 | FR-1.2.3, 1.2.4, DC-2.13 | `cus_normal` มี P2 × 3 (API) | checkout ปิด context → `cus_prime` ดูสินค้า → `cus_normal` login ใหม่ แล้วเปิด `/cart`, `/success`, `/checkout` จากนั้น pay success | `cus_prime` ยังไม่เห็น P2 ทุก URL แสดง `page-checkout` ด้วย orderId เดิม และชำระต่อได้ |
| E2E-26 | FR-1.2.3, DC-2.13, FR-6.4 | `cus_normal` อยู่ stage ชำระเงิน (API) | pay success เปิด `/cart` และ `/checkout` รีโหลด login ใหม่ แล้วกด continue | ทุกกรณียังเป็น `page-success` ของ orderId เดิม หลังกด continue ได้ `page-cart` ที่ว่าง |
| E2E-27 | DC-2.12, DC-2.13 | stage ตะกร้า | เปิด `/products`, `/cart`, `/orders`, `/checkout`, `/success` | สามหน้าแรกแสดงหน้าของตัวเอง ส่วน `/checkout` และ `/success` แสดง `page-cart` |
| E2E-28 | DC-2.12 | — | admin เปิด `/admin/products` และ `/admin/coupons` | แสดง `page-admin-products` และ `page-admin-coupons` |

### 4.6 ออเดอร์ (`06-orders.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-29 | FR-0.6, 0.5.1, 5.3.5 | ออเดอร์ A ถูกยกเลิก แล้วออเดอร์ B ชำระเงินแล้ว (API) | กด continue บน `page-success` เปิด `/orders` กดดู B แล้ว `cus_prime` เปิด `/orders` | มีสองแถวเรียง B ก่อน A สถานะ `ชำระเงินแล้ว` และ `ยกเลิก` total 480 ทั้งสองแถว รายละเอียดของ B แสดง P1 unit 450 qty 1 และยอด 450 / 0 / 30 / 480 ส่วน `cus_prime` ไม่มีแถวใด |
| E2E-30 | AC-15, FR-0.5.2 | `cus_normal` มีออเดอร์ X (API) | `cus_prime` เปิด `/orders/X` แล้วเปิด `/orders/ORDER-THAT-DOES-NOT-EXIST` | ทั้งสองกรณีได้ error `ORDER_NOT_FOUND` |

### 4.7 Admin (`07-admin.spec.ts`)

| ID | FR / AC | Given | When | Then |
|---|---|---|---|---|
| E2E-31 | FR-1.3.2, 9.3.2, 1.3.1 | — | admin ปิดขาย P3 รีโหลด ลูกค้าดูสินค้า แล้ว admin เปิดขาย P3 | admin เห็นราคา สต็อก และสถานะตาม seed หลังปิดขาย P3 มี `ปิดขาย` และยังแสดงในหน้า admin ลูกค้าไม่เห็น P3 หลังเปิดขายลูกค้าเห็น P3 อีกครั้ง |
| E2E-32 | FR-9.1.2 | — | admin แก้ P1 เป็นราคา 500 สต็อก 15 | หน้า admin และ `/products` ของลูกค้าแสดง 500 / 15 |
| E2E-33 | AC-13 | `cus_normal` มีออเดอร์ที่รอชำระของ P1 และ `cus_prime` มี P1 ในตะกร้า (API) | admin แก้ราคา P1 เป็น 500 | `page-checkout` ของ `cus_normal` ยังเป็น 450 / 0 / 30 / 480 ส่วนตะกร้าของ `cus_prime` unit 500 subtotal 500 |
| E2E-34 | AC-19a, AC-19b, FR-10.2, 3.1.2 | — | admin ปิด SAVE10 รีโหลด แล้วลูกค้าผูก SAVE10 | หน้า admin แสดง percent 10, minSpend 1000 และ `ปิดใช้` ลูกค้าได้ error `COUPON_INVALID` และไม่มีคูปองผูก |

### 4.8 AC ที่หน้าเว็บกันไว้ก่อน (`08-ac-guarded-actions.spec.ts`)

AC กลุ่มนี้ทำขั้น When ผ่านปุ่มตามปกติไม่ได้ เพราะหน้าเว็บมีการป้องกันอยู่แล้ว
- AC-1 และ AC-16 ทำผ่านหน้าเว็บโดยใส่ค่าที่ผิดลงใน input
- AC-11c, AC-14 และ AC-17 ทำขั้น When เป็นคำสั่งตรงด้วยบัญชีของผู้ใช้คนนั้น แล้วตรวจขั้น Then ผ่านหน้าเว็บ เพื่อยืนยันว่า api-server ปฏิเสธเอง ไม่ได้พึ่งแค่การซ่อนปุ่ม

| ID | AC | Given | When | Then |
|---|---|---|---|---|
| E2E-35 | AC-1 | ตะกร้าว่าง | เพิ่ม P1 จำนวน 0 ผ่านหน้าเว็บ | error `QTY_OUT_OF_RANGE` และตะกร้ายังว่าง |
| E2E-36 | AC-11c | `cus_normal` จอง P2 × 3 (API) | `cus_prime` สั่ง `addItem(P2, 1)` ตรง | หน้าเว็บไม่แสดง P2 คำสั่งตรงได้ `PRODUCT_UNAVAILABLE` และตะกร้ายังว่าง |
| E2E-37 | AC-14 | `cus_normal` login | `cus_normal` สั่ง `updateProduct(P1, 500)` ตรง | ไม่มีเมนู Admin คำสั่งตรงได้ `AUTH_FORBIDDEN` และ P1 ยังเป็น 450 |
| E2E-38 | AC-16 | admin login | ใส่ราคา 0 และสต็อก 10000 แล้วกดบันทึก | error `VALIDATION_ERROR` และ P1 ยังเป็น 450 / 20 |
| E2E-39 | AC-17 | `cus_normal` อยู่ stage ชำระเงินด้วย P2 × 1 | สั่ง `addItem(P1, 1)` ตรง | `OPERATION_NOT_ALLOWED` ยังอยู่ที่ `page-checkout` ของออเดอร์เดิม ยอด 1200 / 0 / 30 / 1230 สต็อก P1 ยังเป็น 20 และหลังยกเลิกตะกร้ามีแค่ P2 × 1 |

### 4.9 ตารางจับคู่ Acceptance Criteria → E2E

ใช้ตารางนี้เป็นสไลด์หลักตอนนำเสนอ และรันเฉพาะ AC ได้ด้วย `npx playwright test e2e/srs --grep "AC-7"`

| AC | สิ่งที่ตรวจ | เทส | วิธีทำขั้น When |
|---|---|---|---|
| AC-1 | addItem จำนวน 0 | E2E-35 | หน้าเว็บ |
| AC-2 | P1 8 + 3 เกิน 10 | E2E-08 | หน้าเว็บ |
| AC-3 | P2 2 + 2 เกินสต็อก | E2E-09 | หน้าเว็บ |
| AC-4 | prime + SAVE10 = 1485 | E2E-13 | หน้าเว็บ (ทุกขั้น) |
| AC-5 | prime ปัดเศษ = 1568 | E2E-14 | หน้าเว็บ |
| AC-6 | ไม่ถึง minSpend ถอดคูปอง = 880 | E2E-15 | หน้าเว็บ |
| AC-7 | admin ปิดคูปอง = 1230 | E2E-16 | หน้าเว็บ (ข้าม actor) |
| AC-8 | remote express = 15270 | E2E-17 | หน้าเว็บ |
| AC-9 | น้ำหนักเกิน 20 กก. | E2E-18 | หน้าเว็บ |
| AC-10 | admin ปิดขาย P1 | E2E-23 | หน้าเว็บ (ข้าม actor) |
| AC-11a | checkout จองสต็อก P2 = 0 | E2E-21, E2E-25 | หน้าเว็บ |
| AC-11b | ลูกค้าอื่น checkout P2 ไม่ได้ | E2E-22 | หน้าเว็บ (ข้าม actor) |
| AC-11c | ลูกค้าอื่นเพิ่ม P2 ไม่ได้ | E2E-36 | คำสั่งตรง (หน้าเว็บไม่แสดง P2) |
| AC-12 | ยกเลิกแล้วคืนสต็อก | E2E-21 | หน้าเว็บ |
| AC-13 | ราคาในออเดอร์ไม่เปลี่ยน | E2E-33 | หน้า Admin (ข้าม actor) |
| AC-14 | Customer แก้ราคาไม่ได้ | E2E-37 | คำสั่งตรง (ไม่มีเมนู Admin) |
| AC-15 | ดูออเดอร์ของผู้อื่นไม่ได้ | E2E-30 | หน้าเว็บ (URL) |
| AC-16 | ราคา 0 / สต็อก 10000 | E2E-38 | หน้า Admin |
| AC-17 | addItem ระหว่างชำระเงิน | E2E-39 | คำสั่งตรง (หน้า checkout ไม่มีปุ่ม) |
| AC-18a | paySuccess | E2E-19, E2E-20 | ปุ่ม gateway (DC-3.3) |
| AC-18b | continueShopping | E2E-19, E2E-26 | หน้าเว็บ |
| AC-19a | admin ปิด SAVE10 | E2E-34 | หน้า Admin |
| AC-19b | listCoupons แสดงสถานะใหม่ | E2E-34 | หน้า Admin |

## 5. ที่มาของยอดเงินที่คาดหวัง

ตัวเลขทุกตัวคำนวณจาก FR-4 กับ seed data ส่วนที่ 7 (ปัดลงทุกขั้น):

| เทส | ตะกร้า | subtotal | น้ำหนัก → tier | ส่วนลด | ค่าส่ง | total |
|---|---|---|---|---|---|---|
| E2E-19 | normal: P1 × 1, inCity/standard | 450 | 300 → light | 0 | 30 | 480 |
| E2E-20 | normal: P1 × 2, upcountry/express | 900 | 600 → light | 0 | 50 × 3/2 = 75 | 975 |
| E2E-21 | normal: P2 × 3 + SAVE10, inCity/standard | 3600 | 2700 → medium | 3600 × 10% = 360 | 50 | 3290 |
| E2E-13 (AC-4) | prime: P1 + P2 + SAVE10, inCity/standard | 1650 | 1200 → medium | คูปอง 165 | 0 | 1485 |
| E2E-14 (AC-5) | prime: P1 + P2, inCity/standard | 1650 | 1200 → medium | สมาชิก floor(82.5) = 82 | 0 | 1568 |
| E2E-15 (AC-6) | prime: P1 × 2 + SAVE10, upcountry/express | 900 | 600 → light | ถอดคูปอง สมาชิก 45 | 50 × 1/2 = 25 | 880 |
| E2E-16 (AC-7) | normal: P2 × 1 + SAVE10 ที่ถูกปิด, inCity/standard | 1200 | 900 → light | ถอดคูปอง 0 | 30 | 1230 |
| E2E-17 (AC-8) | normal: P3 × 1, remote/express | 15000 | 8000 → heavy | 0 | 180 × 3/2 = 270 | 15270 |
| E2E-29, E2E-33 | normal: P1 × 1, inCity/standard | 450 | 300 → light | 0 | 30 | 480 |

## 6. สิ่งที่ไม่ทดสอบที่ E2E

| เรื่อง | เหตุผล | ระดับที่ควรทดสอบ |
|---|---|---|
| ค่าขอบเขตทั้งหมดของ quantity, price, stock และน้ำหนัก (BVA/ECT) นอกเหนือจาก AC-1 และ AC-16 | เป็นการตรวจกฎล้วน ทำที่ระดับล่างได้เร็วกว่า | unit (DC-1) และ service |
| Decision Table FR-4.2–4.4 ทั้ง 7 rule และ pairwise ของค่าส่ง | เป็นการคำนวณล้วน ใช้ pure function | unit |
| `OPERATION_NOT_ALLOWED` ของ operation อื่นนอกจาก AC-17 (FR-8) | หน้าเว็บแสดงเฉพาะหน้าของ stage ปัจจุบัน | service |
| `AUTH_REQUIRED` และ `AUTH_FORBIDDEN` ของ endpoint อื่นนอกจาก AC-14 | เป็นการปฏิเสธระดับ API ส่วนพฤติกรรมของหน้าเว็บ spec ไม่ได้กำหนด (SOI-1, SOI-4) | service |
| `removeItem` ขณะตะกร้าว่าง (`CART_EMPTY`) และ `updateQuantity` กับสินค้าที่ไม่อยู่ในตะกร้า | หน้าเว็บไม่มีปุ่มให้ทำ | service |
| `ITEMS_UNAVAILABLE` ระบุ productId ที่ไม่ผ่าน | spec ไม่ได้กำหนดว่าหน้าจอต้องแสดงรายการนี้ | service |

## 7. Open Issue Log

จุดที่ spec ไม่ได้กำหนดซึ่งพบระหว่างออกแบบ ไม่มีเทสที่ใช้ค่าคาดหวังของจุดเหล่านี้ (ส่วนที่ 9)

| ID | ประเด็น | ผลต่อชุดเทส |
|---|---|---|
| SOI-1 | Customer เปิดหน้าของ Admin (`/admin/products`) หรือ Admin เปิดหน้าของ Customer (`/cart`) แล้วหน้าเว็บต้องแสดงอะไร spec กำหนดไว้เฉพาะ `AUTH_FORBIDDEN` ระดับ API (FR-0.3) | ไม่มีเทส |
| SOI-2 | DC-2.13 ใช้กับ "หน้าที่ไม่ตรงกับ stage" แต่ `page-products`, `page-orders`, `page-order-detail` ไม่ได้ตรงกับ stage ใด จึงไม่ชัดว่าเปิดได้หรือไม่ขณะอยู่ stage ชำระเงินหรือสำเร็จ (FR-8.5.2 อนุญาต operation ระดับ API) | ไม่เปิดหน้าเหล่านี้ขณะอยู่ stage ชำระเงินหรือสำเร็จ E2E-29 จึงกด continue ก่อนเปิด `/orders` และ E2E-33 ตรวจราคาในออเดอร์จาก `page-checkout` |
| SOI-3 | หลัง login สำเร็จต้องไปหน้าใด ทั้ง Customer และ Admin | ไม่ตรวจหน้าแรกหลัง login เทสเปิด URL ที่ต้องการเอง |
| SOI-4 | ผู้ใช้ที่ยังไม่ login เปิด URL ที่ต้อง login แล้วหน้าเว็บต้องแสดงอะไร | ไม่มีเทส |
| SOI-5 | `checkout-order-id`, `success-order-id`, `order-detail-id` ไม่มี `data-value` และ spec ไม่ได้กำหนดรูปแบบข้อความ | เทสถือว่าข้อความของ element คือ orderId และอนุญาตให้มี `#` นำหน้า |
| SOI-6 | FR-1.3.1 ให้แสดงน้ำหนักต่อชิ้น แต่ตาราง 6.2.1 ไม่มี testid สำหรับน้ำหนัก | ไม่ตรวจน้ำหนักบนหน้า products |
| SOI-7 | `app-message` แสดงนานเท่าใด และมีหลายข้อความพร้อมกันได้หรือไม่ | เทสตรวจว่ามี `app-message` ที่ตรงเงื่อนไขอย่างน้อยหนึ่งตัวหลังการกระทำทันที |

ข้อที่ตีความจาก spec ได้ จึงไม่นับเป็น SOI:

- ข้อความของ `payFail` (FR-6.2.1) ไม่ใช่การปฏิเสธและไม่ใช่ notice จึงเป็น `data-kind="info"` ตาม DC-2.8
- เมนู `nav-cart` และ `nav-orders` เป็นของ Customer และ `nav-admin-*` เป็นของ Admin ตามวงเล็บในตาราง 6.2.1 และสิทธิ์ใน FR-0.3

## 8. การตรวจชุดเทส

- ผ่าน TypeScript strict และ `playwright test --list` พบ 39 เทสใน 8 ไฟล์
- รันกับหน้าเว็บจริงของโปรเจกต์ (build `src/client` ด้วย esbuild) คู่กับ backend จำลองที่ตอบแบบเดียวกับ controller ในโปรเจกต์ บน chromium ผ่าน 39/39 และรันซ้ำ 3 รอบผ่าน 117/117
- ยังไม่ได้รันกับ backend จริงและ Supabase เพราะต้องใช้ `.env` ในเครื่องของกลุ่ม ให้รัน `npx playwright test` ในเครื่องเพื่อยืนยัน
- **Mutation check:** ใส่ข้อผิดพลาดลงใน backend จำลองทีละจุดแล้วรันซ้ำ ทุกจุดมีเทสล้ม

| ข้อผิดพลาดที่ใส่ | เทสที่จับได้ |
|---|---|
| `GET /cart` เปลี่ยน stage จาก สำเร็จ เป็น ตะกร้า | E2E-19, 20, 25, 26, 29 |
| prime + express คิดค่าส่ง × 3/2 | E2E-15 |
| `payFail` พากลับไปที่ตะกร้า | E2E-20 |
| `cancelCheckout` ถอดคูปอง | E2E-21 |
| orders เรียงจากเก่าไปใหม่ | E2E-29 |
| ถอดคูปองโดยไม่แจ้ง notice | E2E-15, 16 |
| สินค้าที่สต็อก 0 ยังนับเป็นสินค้าพร้อมขาย | E2E-21, 22, 25 |

## 9. สิ่งที่แก้ในโปรเจกต์เพื่อให้เป็นไปตาม spec

| # | เดิม | แก้เป็น | ข้อกำหนด |
|---|---|---|---|
| F-1 | หน้าเว็บไม่มี `data-testid`, `data-value`, `data-status`, `data-available` และ `app-message` | ใส่ครบตามตาราง 6.2.1 และข้อความทุกตัวแสดงเป็น `app-message` ที่มี `data-kind`, `data-code` | DC-2.4–2.11 |
| F-2 | เลือกหน้าด้วย state (`currentView`) | เลือกหน้าจาก URL บทบาท และ stage (`App.tsx`) โดยอ่าน stage จาก `GET /me` | DC-2.12, DC-2.13, FR-1.2.3 |
| F-3 | vite proxy ทุก request ของ `/cart`, `/orders` ไปที่ backend | request ที่ browser ขอหน้าเว็บ (`Accept: text/html`) ได้ `index.html` ส่วน fetch ยังไป backend และเพิ่ม `/me`, `/admin` | DC-2.12 |
| F-4 | ไม่มีหน้า Admin | เพิ่ม `AdminProductsPage`, `AdminCouponsPage` | FR-1.3.2, FR-9, FR-10.2 |
| F-5 | `GET /cart` เปลี่ยน stage สำเร็จ เป็น ตะกร้า | `GET /cart` ดูอย่างเดียว เพิ่ม `POST /cart/continue` สำหรับ continueShopping | FR-1.2.3, FR-6.4, FR-8.5.2 |
| F-6 | `GET /cart` และคำสั่งแก้ตะกร้าถอดคูปองที่ยอดยังไม่ถึงขั้นต่ำ | คูปองคงผูกอยู่ ประเมินและถอดเฉพาะตอน pressCheckout | FR-2.9, FR-3.2.2, FR-5.2.2, FR-10.1.3 |
| F-7 | เลือกการจัดส่งในหน้า checkout และซ่อนปุ่มเมื่อตะกร้าว่าง | `zone-select`, `speed-select`, `checkout-button` อยู่ในหน้าตะกร้า ปุ่มเป็น `disabled` เมื่อตะกร้าว่าง | ตาราง 6.2.1, FR-2.8 |
| F-8 | ปุ่มบนหน้า success พาไปหน้าสินค้า | เรียก continueShopping แล้วไปหน้าตะกร้า | FR-6.4 |
| F-9 | `API.md` เขียนสถานะ `ชำระเงินสำเร็จ` | แก้เป็น `ชำระเงินแล้ว` และเพิ่ม `/me`, `/cart/continue` | ส่วนที่ 2 |
| — | หน้าสินค้าแสดงสินค้าที่ปิดขายหรือสต็อก 0 (ปุ่มกดไม่ได้) | ซ่อนสินค้าที่ไม่พร้อมขาย เพิ่มช่องจำนวนและแสดงน้ำหนัก | FR-1.3.1 |
| — | payFail แสดง "ชำระเงินไม่สำเร็จ สินค้ายังอยู่ในตะกร้า" | แสดงข้อความตาม FR-6.2.1 จาก api-server | FR-6.2.1 |
| — | checkout ไม่แสดง notice เมื่อคูปองถูกถอด | แสดง `app-message` notice `COUPON_NOT_APPLICABLE` | FR-4.3.2 |

ผลกับเทสระดับอื่น:
- unit: แก้ `cart.unit.test.ts` (ย้ายเทส continueShopping ออกจาก viewCart, เพิ่มเทสว่า viewCart ไม่เปลี่ยน stage, applyCoupon เรียก `buildCartSummary(cart)`) และ `cart.stub.test.ts` ST-11 (คูปองไม่ถูกถอดตอนสรุปตะกร้า)
- API test (`tests/api.test.ts`): ไม่ต้องแก้
- Postman: "OP-12 continueShopping" เปลี่ยนเป็น `POST /cart/continue`
- E2E ชุดเดิม `e2e/checkout.spec.ts`: ใช้กับหน้าเว็บแบบเดิม `playwright.config.ts` จึงตั้ง `testDir` เป็น `./e2e/srs`
