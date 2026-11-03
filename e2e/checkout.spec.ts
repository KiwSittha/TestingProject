import { test, expect } from '@playwright/test';
import {
  CUSTOMER,
  PRODUCTS,
  ShopApi,
  addToCartUI,
  cartButton,
  cartRow,
  createOrderUI,
  fillLogin,
  goToCheckoutUI,
  loginUI,
  resetTestData,
  type Order,
} from './helpers';

// E2E เฉพาะ critical user journey: login → ใส่ตะกร้า → สร้างคำสั่งซื้อ → ชำระเงิน / ชำระไม่สำเร็จ / ยกเลิก
// เลข SC และ TC ตรงกับ docs/e2e-design.md

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
    // 1. login
    await loginUI(page);

    // 2–3. เพิ่ม Coffee Beans 2 ครั้ง
    await addToCartUI(page, 'P1', 1);
    await expect.poll(() => api.quantityInCart('P1')).toBe(1);
    await addToCartUI(page, 'P1', 2);
    await expect.poll(() => api.quantityInCart('P1')).toBe(2);

    // 4. เปิดตะกร้าแล้วกด "ดำเนินการชำระเงิน"
    await goToCheckoutUI(page, 2);
    await expect(page.getByText('x2')).toBeVisible();

    // 5. เลือก "กรุงเทพฯ" + "ส่งแบบปกติ" แล้วกด "สร้างคำสั่งซื้อ"
    const orderId = await createOrderUI(page, 'กรุงเทพฯ', 'ส่งแบบปกติ');
    await expect(page.getByText('฿40.00')).toBeVisible();
    await expect(page.getByText('฿940.00')).toBeVisible();
    expect(await api.order(orderId)).toMatchObject({ status: 'รอชำระเงิน', net_total: 940 });

    // 6. กด "ยืนยันชำระเงิน"
    await page.getByRole('button', { name: 'ยืนยันชำระเงิน' }).click();
    await expect(page.getByRole('heading', { name: `ชำระเงินสำเร็จ! คำสั่งซื้อ #${orderId} ได้รับการยืนยันแล้ว` })).toBeVisible();
    await expect(cartButton(page, 0)).toBeVisible();
    expect((await api.order(orderId)).status).toBe('ชำระเงินสำเร็จ');
    expect(await api.stock('P1')).toBe(PRODUCTS.P1.stock - 2);
    expect(await api.quantityInCart('P1')).toBe(0);

    // 7. กด "ไปที่ประวัติคำสั่งซื้อ"
    await page.getByRole('button', { name: 'ไปที่ประวัติคำสั่งซื้อ' }).click();
    await expect(page.getByRole('heading', { name: 'ประวัติคำสั่งซื้อและการจัดซื้อของฉัน' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: orderId })).toContainText('ชำระเงินสำเร็จ');
  });
});

test.describe('SC-02 ชำระเงินไม่สำเร็จแล้วสินค้ายังอยู่ในตะกร้า', () => {
  test('TC-02 ชำระเงินไม่สำเร็จ', async ({ page }) => {
    // 1–2. login แล้วเพิ่ม Coffee Beans 1 ชิ้น
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);

    // 3. เปิดตะกร้า กด "ดำเนินการชำระเงิน"
    await goToCheckoutUI(page, 1);

    // 4. เลือก "ต่างจังหวัด" + "ส่งด่วน" แล้วกด "สร้างคำสั่งซื้อ"
    const orderId = await createOrderUI(page, 'ต่างจังหวัด', 'ส่งด่วน');
    await expect(page.getByText('฿120.00')).toBeVisible();
    await expect(page.getByText('฿570.00')).toBeVisible();
    expect(await api.order(orderId)).toMatchObject({ status: 'รอชำระเงิน', net_total: 570 });

    // 5. กด "จำลองชำระเงินไม่สำเร็จ"
    await page.getByRole('button', { name: 'จำลองชำระเงินไม่สำเร็จ' }).click();
    await expect(page.getByText('ชำระเงินไม่สำเร็จ สินค้ายังอยู่ในตะกร้า')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ตะกร้าสินค้าสำหรับองค์กร' })).toBeVisible();
    await expect(cartRow(page, 'P1')).toContainText('฿450.00');
    await expect(cartButton(page, 1)).toBeVisible();
    expect((await api.order(orderId)).status).toBe('ชำระเงินไม่สำเร็จ');
    expect(await api.quantityInCart('P1')).toBe(1);
    expect(await api.stock('P1')).toBe(PRODUCTS.P1.stock);
  });
});

test.describe('SC-03 ยกเลิกคำสั่งซื้อแล้วสินค้ายังอยู่ในตะกร้า', () => {
  test('TC-03 ยกเลิกคำสั่งซื้อที่รอชำระเงิน', async ({ page }) => {
    // 1–2. login แล้วเพิ่ม Coffee Beans 1 ชิ้น
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);

    // 3. เปิดตะกร้า กด "ดำเนินการชำระเงิน"
    await goToCheckoutUI(page, 1);

    // 4. เลือก "ต่างจังหวัด" + "ส่งด่วน" แล้วกด "สร้างคำสั่งซื้อ"
    const orderId = await createOrderUI(page, 'ต่างจังหวัด', 'ส่งด่วน');
    await expect(page.getByText('฿120.00')).toBeVisible();
    await expect(page.getByText('฿570.00')).toBeVisible();
    expect(await api.order(orderId)).toMatchObject({ status: 'รอชำระเงิน', net_total: 570 });

    // 5. กด "ยกเลิกคำสั่งซื้อ"
    await page.getByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' }).click();
    await expect(page.getByText(`ยกเลิกคำสั่งซื้อ ${orderId} แล้ว`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ตะกร้าสินค้าสำหรับองค์กร' })).toBeVisible();
    await expect(cartRow(page, 'P1')).toContainText('฿450.00');
    await expect(cartButton(page, 1)).toBeVisible();
    expect((await api.order(orderId)).status).toBe('ยกเลิก');
    expect(await api.quantityInCart('P1')).toBe(1);
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
