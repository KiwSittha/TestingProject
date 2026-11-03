import { test, expect } from '@playwright/test';
import {
  CUSTOMER,
  PRODUCTS,
  ShopApi,
  addToCartUI,
  cartButton,
  cartRow,
  fillLogin,
  goToCheckoutUI,
  loginUI,
  resetTestData,
  type Order,
} from './helpers';

// E2E เฉพาะ critical user journey: login → ใส่ตะกร้า → checkout → จ่ายเงิน / จ่ายไม่สำเร็จ / ยกเลิก
// เลข SC และ TC ตรงกับ docs/e2e-design.md
// หน้าเว็บยังทำตาม spec ไม่ได้บางส่วน เทสนั้นใส่ test.fail() พร้อมเลข defect ไว้
// ผลฝั่ง backend ตรวจด้วย soft assertion เพื่อให้เทสเดินหน้าเว็บต่อจนจบและรายงาน defect ครบทุกจุด
const DEF = {
  noApi: 'DEF-04 หน้า checkout ไม่เรียก API (OP-8/9/10) order จึงไม่ถูกสร้างใน backend',
  payFail: 'DEF-06 หน้า checkout ไม่มีปุ่มชำระเงินไม่สำเร็จ (OP-11)',
};

const backend = expect.configure({ soft: true });

let api: ShopApi;
let ordersBefore: Order[];

test.beforeEach(async ({ request }) => {
  api = await resetTestData(request);
  ordersBefore = await api.orders();
});

test.afterAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  await resetTestData(request);
  await request.dispose();
});

test.describe('SC-01 ซื้อสินค้าและชำระเงินสำเร็จ', () => {
  test('TC-01 ซื้อ Coffee Beans 2 ชิ้นแล้วชำระเงินสำเร็จ', async ({ page }) => {
    test.fail(true, DEF.noApi);

    // 1. login
    await loginUI(page);

    // 2–3. เพิ่ม Coffee Beans 2 ครั้ง
    await addToCartUI(page, 'P1', 1);
    await expect.poll(() => api.quantityInCart('P1')).toBe(1);
    await addToCartUI(page, 'P1', 2);
    await expect.poll(() => api.quantityInCart('P1')).toBe(2);

    // 4–5. เปิดตะกร้าแล้วกด "ดำเนินการชำระเงิน" → ได้ order รอชำระเงิน
    await goToCheckoutUI(page, 2);
    await expect(page.getByText('x2')).toBeVisible();
    await backend.poll(async () => (await api.newOrder(ordersBefore))?.status).toBe('รอชำระเงิน');

    // 6. กด "ยืนยันสั่งซื้อและชำระเงิน"
    await page.getByRole('button', { name: 'ยืนยันสั่งซื้อและชำระเงิน' }).click();
    const success = page.getByRole('heading', { name: /ชำระเงินสำเร็จ! คำสั่งซื้อ #/ });
    await expect(success).toBeVisible();
    await expect(cartButton(page, 0)).toBeVisible();
    const orderId = (await success.textContent())?.match(/#(\S+)/)?.[1] ?? '';
    await backend.poll(async () => (await api.orders()).find(o => o.id === orderId)?.status).toBe('ชำระเงินสำเร็จ');
    backend(await api.stock('P1')).toBe(PRODUCTS.P1.stock - 2);
    backend(await api.quantityInCart('P1')).toBe(0);

    // 7. กด "ไปที่ประวัติคำสั่งซื้อ"
    await page.getByRole('button', { name: 'ไปที่ประวัติคำสั่งซื้อ' }).click();
    await expect(page.getByRole('heading', { name: 'ประวัติคำสั่งซื้อและการจัดซื้อของฉัน' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: orderId })).toContainText('ชำระเงินสำเร็จ');
  });
});

test.describe('SC-02 ชำระเงินไม่สำเร็จแล้วสินค้ายังอยู่ในตะกร้า', () => {
  test('TC-02 ชำระเงินไม่สำเร็จ', async ({ page }) => {
    test.fail(true, `${DEF.noApi} / ${DEF.payFail}`);

    // 1–2. login แล้วเพิ่ม Coffee Beans 1 ชิ้น
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);

    // 3. เปิดตะกร้าแล้วกด "ดำเนินการชำระเงิน"
    await goToCheckoutUI(page, 1);
    await backend.poll(async () => (await api.newOrder(ordersBefore))?.status).toBe('รอชำระเงิน');

    // 4. กด "ชำระเงินไม่สำเร็จ"
    const payFail = page.getByRole('button', { name: 'ชำระเงินไม่สำเร็จ' });
    await expect(payFail).toBeVisible();
    await payFail.click();
    await expect(cartButton(page, 1)).toBeVisible();
    await backend.poll(async () => (await api.newOrder(ordersBefore))?.status).toBe('ชำระเงินไม่สำเร็จ');
    backend(await api.quantityInCart('P1')).toBe(1);
    backend(await api.stock('P1')).toBe(PRODUCTS.P1.stock);

    // 5. เปิดตะกร้า
    await cartButton(page, 1).click();
    await expect(cartRow(page, 'P1')).toContainText('฿450.00');
  });
});

test.describe('SC-03 ยกเลิกคำสั่งซื้อแล้วสินค้ายังอยู่ในตะกร้า', () => {
  test('TC-03 ยกเลิกที่หน้า checkout', async ({ page }) => {
    test.fail(true, DEF.noApi);

    // 1–2. login แล้วเพิ่ม Coffee Beans 1 ชิ้น
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);

    // 3. เปิดตะกร้าแล้วกด "ดำเนินการชำระเงิน"
    await goToCheckoutUI(page, 1);
    await backend.poll(async () => (await api.newOrder(ordersBefore))?.status).toBe('รอชำระเงิน');

    // 4. กด "กลับไปตะกร้าสินค้า" (OP-9 cancelCheckout)
    await page.getByRole('button', { name: 'กลับไปตะกร้าสินค้า' }).click();
    await expect(page.getByRole('heading', { name: 'ตะกร้าสินค้าสำหรับองค์กร' })).toBeVisible();
    await expect(cartRow(page, 'P1')).toContainText('฿450.00');
    await expect(cartButton(page, 1)).toBeVisible();
    await backend.poll(async () => (await api.newOrder(ordersBefore))?.status).toBe('ยกเลิก');
    backend(await api.quantityInCart('P1')).toBe(1);
  });
});

test.describe('SC-04 ตะกร้าว่างแล้วชำระเงินไม่ได้', () => {
  test('TC-04 เปิดตะกร้าว่าง', async ({ page }) => {
    // 1. login
    await loginUI(page);

    // 2. กด "ตะกร้าสินค้า 0"
    await cartButton(page, 0).click();
    await expect(page.getByRole('heading', { name: 'ตะกร้าสินค้าของคุณยังว่างอยู่' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ดำเนินการชำระเงิน' })).toHaveCount(0);
    expect(await api.orders()).toHaveLength(ordersBefore.length);
  });
});

test.describe('SC-05 login ผิด', () => {
  const cases = [
    { id: 'TC-05', title: 'รหัสผ่านผิด', username: CUSTOMER, pass: 'wrong-password' },
    { id: 'TC-06', title: 'ไม่มีชื่อผู้ใช้นี้', username: 'no_such_user', pass: 'wrong-password' },
  ];

  for (const { id, title, username, pass } of cases) {
    test(`${id} ${title}`, async ({ page }) => {
      // 1. กรอกชื่อผู้ใช้และรหัสผ่านแล้วกด "เข้าสู่ระบบ"
      await fillLogin(page, username, pass);
      await expect(page.getByText('AUTH_INVALID_CREDENTIALS').first()).toBeVisible();
      await expect(page.getByText('Invalid username or password').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ EatSomeWhere' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^ตะกร้าสินค้า/ })).toHaveCount(0);
    });
  }
});
