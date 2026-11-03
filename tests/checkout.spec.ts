import { test, expect } from '@playwright/test';
import {
  ADMIN,
  COUPON,
  PRODUCTS,
  ShopApi,
  addToCartUI,
  applyCouponUI,
  cartButton,
  cartRow,
  checkoutUI,
  clickAddToCart,
  confirmOrderUI,
  loginUI,
  resetTestData,
} from './helpers';

// รายละเอียด spec, scenario, test case และ defect อยู่ใน docs/e2e-design.md
// เทสที่หน้าเว็บยังทำตาม spec ไม่ได้ ใส่ test.fail() พร้อมเลข defect ไว้
const DEF = {
  coupon: 'DEF-01 หน้าตะกร้าไม่มีช่องใส่คูปอง',
  shipping: 'DEF-02 หน้า checkout ไม่มีให้เลือกพื้นที่และความเร็วในการจัดส่ง',
  cartSync: 'DEF-03 การแก้ไขตะกร้าในหน้าเว็บไม่ส่งไป backend',
  pendingOrder: 'DEF-04 การยืนยันสั่งซื้อไม่เรียก API จึงไม่ตรวจ order ที่ค้างชำระ',
  cancel: 'DEF-05 ไม่มีปุ่มยกเลิกคำสั่งซื้อ',
  payFail: 'DEF-06 ไม่มีทางทำรายการชำระเงินไม่สำเร็จ',
  history: 'DEF-07 หน้าประวัติคำสั่งซื้อไม่ดึงข้อมูลจาก backend',
  checkoutApi: 'DEF-08 OP-8 checkout ตอบ 500 เพราะ database ไม่รับค่า zone (orders_zone_check)',
};

test.describe('สั่งซื้อและชำระเงิน', () => {
  // ทุกเทสใช้บัญชีและสินค้าชุดเดียวกันใน database จริง รันบน chromium อย่างเดียวพอ
  test.skip(({ browserName }) => browserName !== 'chromium', 'เทสกฎทางธุรกิจ ไม่ขึ้นกับ browser');

  let api: ShopApi;

  test.beforeEach(async ({ request }) => {
    api = await resetTestData(request);
  });

  test.afterAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    await resetTestData(request);
    await request.dispose();
  });

  // ---------- SC-01 ซื้อสินค้าและชำระเงินสำเร็จ ----------

  test('TC-01 ซื้อพร้อมคูปองสำเร็จ', async ({ page }) => {
    test.fail(true, DEF.coupon);
    await loginUI(page);
    for (const count of [1, 2, 3]) await addToCartUI(page, 'P1', count);

    await cartButton(page, 3).click();
    await expect(cartRow(page, 'P1')).toContainText('฿1,350.00');

    await applyCouponUI(page, COUPON.code);
    await expect(page.getByText('฿135.00')).toBeVisible();

    await checkoutUI(page, 'กรุงเทพ', 'ปกติ');
    await expect(page.getByText('฿40.00')).toBeVisible();
    await expect(page.getByText('฿1,255.00')).toBeVisible();
    await confirmOrderUI(page);
    await page.getByRole('button', { name: 'ชำระเงินสำเร็จ' }).click();
    await expect(page.getByText(/ชำระเงินสำเร็จ! คำสั่งซื้อ #/)).toBeVisible();
    await expect(cartButton(page, 0)).toBeVisible();

    const [order] = await api.orders();
    expect(order).toMatchObject({ status: 'ชำระเงินสำเร็จ', net_total: 1255 });
    expect(await api.stock('P1')).toBe(PRODUCTS.P1.stock - 3);
    expect((await api.cart()).items).toHaveLength(0);
  });

  test('TC-02 ซื้อไม่ใช้คูปอง ส่งต่างจังหวัดแบบด่วน', async ({ page }) => {
    test.fail(true, DEF.shipping);
    await loginUI(page);
    await addToCartUI(page, 'P2', 1);
    await cartButton(page, 1).click();

    await checkoutUI(page, 'ต่างจังหวัด', 'ด่วน');
    await expect(page.getByText('฿120.00')).toBeVisible();
    await expect(page.getByText('฿1,320.00')).toBeVisible();
    await confirmOrderUI(page);
    await page.getByRole('button', { name: 'ชำระเงินสำเร็จ' }).click();
    await expect(page.getByText(/ชำระเงินสำเร็จ! คำสั่งซื้อ #/)).toBeVisible();

    const [order] = await api.orders();
    expect(order).toMatchObject({ status: 'ชำระเงินสำเร็จ', net_total: 1320 });
    expect(await api.stock('P2')).toBe(PRODUCTS.P2.stock - 1);
  });

  // ---------- SC-02 ระบบปฏิเสธการเพิ่มสินค้าที่ผิดเงื่อนไข ----------

  test('TC-03 เพิ่มเกิน 10 ชิ้นต่อสินค้า', async ({ page }) => {
    await api.addToCart('P1', 10);
    await loginUI(page);
    await clickAddToCart(page, 'P1');

    await expect(page.getByText('QTY_OUT_OF_RANGE')).toBeVisible();
    expect(await api.quantityInCart('P1')).toBe(10);
  });

  test('TC-04 เพิ่มจนพอดี 10 ชิ้น', async ({ page }) => {
    await api.addToCart('P1', 9);
    await loginUI(page);
    await clickAddToCart(page, 'P1');

    await expect(page.getByText('ลงตะกร้าเรียบร้อยแล้ว')).toBeVisible();
    await expect.poll(() => api.quantityInCart('P1')).toBe(10);
  });

  test('TC-05 เพิ่มเกิน stock', async ({ page }) => {
    await loginUI(page);
    for (const count of [1, 2, 3]) await addToCartUI(page, 'P2', count);
    await clickAddToCart(page, 'P2');

    await expect(page.getByText('INSUFFICIENT_STOCK')).toBeVisible();
    expect(await api.quantityInCart('P2')).toBe(PRODUCTS.P2.stock);
  });

  test('TC-06 น้ำหนักรวมเกิน 20 กก.', async ({ page }) => {
    await api.addToCart('P3', 2);
    await loginUI(page);
    await clickAddToCart(page, 'P3');

    await expect(page.getByText('WEIGHT_LIMIT_EXCEEDED')).toBeVisible();
    expect(await api.quantityInCart('P3')).toBe(2);
  });

  test('TC-07 เพิ่มสินค้าที่ปิดขาย', async ({ page, request }) => {
    await (await ShopApi.login(request, ADMIN)).setProductStatus('P1', 'ปิดขาย');
    await loginUI(page);
    await clickAddToCart(page, 'P1');

    await expect(page.getByText('PRODUCT_UNAVAILABLE')).toBeVisible();
    expect(await api.quantityInCart('P1')).toBe(0);
  });

  // ---------- SC-03 จัดการรายการในตะกร้า ----------

  test('TC-08 ลบสินค้าออกจากตะกร้า', async ({ page }) => {
    test.fail(true, DEF.cartSync);
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);
    await addToCartUI(page, 'P2', 2);
    await cartButton(page, 2).click();

    await cartRow(page, 'P1').getByTitle('ลบรายการ').click();
    await expect(cartRow(page, 'P1')).toHaveCount(0);
    await expect(cartRow(page, 'P2')).toBeVisible();
    await expect.poll(() => api.quantityInCart('P1')).toBe(0);
    expect(await api.quantityInCart('P2')).toBe(1);
  });

  // ---------- SC-04 ระบบปฏิเสธคูปองที่ใช้ไม่ได้ ----------

  test('TC-09 คูปองยอดไม่ถึงขั้นต่ำ', async ({ page }) => {
    test.fail(true, DEF.coupon);
    await loginUI(page);
    for (const count of [1, 2]) await addToCartUI(page, 'P1', count);
    await cartButton(page, 2).click();

    await applyCouponUI(page, COUPON.code);
    await expect(page.getByText('COUPON_NOT_APPLICABLE')).toBeVisible();
  });

  test('TC-10 คูปองที่ไม่มีอยู่', async ({ page }) => {
    test.fail(true, DEF.coupon);
    await loginUI(page);
    for (const count of [1, 2, 3]) await addToCartUI(page, 'P1', count);
    await cartButton(page, 3).click();

    await applyCouponUI(page, 'NOPE');
    await expect(page.getByText('COUPON_NOT_FOUND')).toBeVisible();
  });

  test('TC-11 คูปองถูกถอดเมื่อยอดต่ำกว่าขั้นต่ำ', async ({ page }) => {
    test.fail(true, DEF.coupon);
    await loginUI(page);
    for (const count of [1, 2, 3]) await addToCartUI(page, 'P1', count);
    await cartButton(page, 3).click();
    await applyCouponUI(page, COUPON.code);
    await expect(page.getByText('฿135.00')).toBeVisible();

    await cartRow(page, 'P1').getByRole('button', { name: 'remove' }).click();
    await expect(page.getByText('฿135.00')).toHaveCount(0);
    await expect.poll(async () => (await api.cart()).coupon).toBeNull();
  });

  // ---------- SC-05 checkout ไม่ได้เมื่อเงื่อนไขไม่ครบ ----------

  test('TC-12 checkout ตะกร้าว่าง', async ({ page }) => {
    await loginUI(page);
    await cartButton(page, 0).click();

    await expect(page.getByText('ตะกร้าสินค้าของคุณยังว่างอยู่')).toBeVisible();
    await expect(page.getByRole('button', { name: /ดำเนินการชำระเงิน/ })).toHaveCount(0);
  });

  test('TC-13 checkout ซ้ำขณะมี order ค้างชำระ', async ({ page }) => {
    test.fail(true, `${DEF.checkoutApi} / ${DEF.shipping} / ${DEF.pendingOrder}`);
    await api.addToCart('P1', 1);
    const pending = await api.checkout();

    await loginUI(page);
    await addToCartUI(page, 'P2', 1);
    await cartButton(page, 1).click();
    await checkoutUI(page, 'กรุงเทพ', 'ปกติ');
    await confirmOrderUI(page);

    await expect(page.getByText(pending.id)).toBeVisible();
    await expect(page.getByText(/ชำระเงินสำเร็จ! คำสั่งซื้อ #/)).toHaveCount(0);
  });

  // ---------- SC-06 ยกเลิก checkout ----------

  test('TC-14 ยกเลิกคำสั่งซื้อที่รอชำระ', async ({ page }) => {
    test.fail(true, `${DEF.shipping} / ${DEF.cancel}`);
    await loginUI(page);
    for (const count of [1, 2, 3]) await addToCartUI(page, 'P1', count);
    await cartButton(page, 3).click();
    await checkoutUI(page, 'กรุงเทพ', 'ปกติ');
    await confirmOrderUI(page);

    await page.getByRole('button', { name: 'ยกเลิกคำสั่งซื้อ' }).click();
    await expect(cartRow(page, 'P1')).toBeVisible();
    const [order] = await api.orders();
    expect(order.status).toBe('ยกเลิก');
    expect(await api.quantityInCart('P1')).toBe(3);
  });

  // ---------- SC-07 ชำระเงินไม่สำเร็จ ----------

  test('TC-15 ชำระเงินไม่สำเร็จแล้วสั่งซื้อใหม่ได้', async ({ page }) => {
    test.fail(true, `${DEF.shipping} / ${DEF.payFail}`);
    await loginUI(page);
    await addToCartUI(page, 'P1', 1);
    await cartButton(page, 1).click();
    await checkoutUI(page, 'กรุงเทพ', 'ปกติ');
    await confirmOrderUI(page);

    await page.getByRole('button', { name: 'ชำระเงินไม่สำเร็จ' }).click();
    const [failed] = await api.orders();
    expect(failed.status).toBe('ชำระเงินไม่สำเร็จ');
    expect(await api.quantityInCart('P1')).toBe(1);

    await cartButton(page, 1).click();
    await checkoutUI(page, 'กรุงเทพ', 'ปกติ');
    await confirmOrderUI(page);
    const [retry] = await api.orders();
    expect(retry.id).not.toBe(failed.id);
    expect(retry.status).toBe('รอชำระเงิน');
  });

  // ---------- SC-08 ดูประวัติคำสั่งซื้อ ----------

  test('TC-16 ประวัติคำสั่งซื้อแสดง order ของตัวเอง', async ({ page }) => {
    test.fail(true, `${DEF.checkoutApi} / ${DEF.history}`);
    await api.addToCart('P1', 1);
    const order = await api.pay((await api.checkout()).id, 'success');

    await loginUI(page);
    await page.getByRole('button', { name: 'คำสั่งซื้อ', exact: true }).click();
    await expect(page.getByText(order.id)).toBeVisible();

    const notMine = await api.call('GET', '/orders/ORD-NOT-MINE');
    expect(notMine).toMatchObject({ status: 404, body: { code: 'ORDER_NOT_FOUND' } });
  });
});
