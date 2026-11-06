import { test, expect } from './support/fixtures';
import { ACCOUNTS, SEED_COUPON, URLS } from './support/seed';
import {
  addItemUI,
  applyCouponUI,
  checkoutToPaymentUI,
  expectCartEmpty,
  expectCartLine,
  expectCouponBound,
  expectOnPage,
  expectOrderId,
  openCart,
  paySuccessUI,
  productRow,
  readOrderId,
} from './support/ui';

// FR-1.2 ข้อมูลคงอยู่ข้ามการ login, DC-2.12 เปิดหน้าด้วย URL ได้โดยตรง
// DC-2.13 เปิด URL ที่ไม่ตรงกับ stage แล้วต้องเห็นหน้าของ stage ปัจจุบัน
// หน้าที่ตรงกับ stage: ตะกร้า = page-cart, ชำระเงิน = page-checkout, สำเร็จ = page-success
// ไม่เปิด /products หรือ /orders ขณะอยู่ stage ชำระเงินหรือสำเร็จ เพราะ spec ไม่ได้กำหนด (SOI-2)

test.describe('FR-1.2 ข้อมูลคงอยู่ข้ามการ login', () => {
  test('E2E-24 [FR-1.2.1, FR-1.2.2] login ใหม่แล้วรายการในตะกร้าและคูปองยังอยู่', async ({ loginAs }) => {
    const first = await loginAs(ACCOUNTS.normal);
    await addItemUI(first, 'P1', 1);
    await openCart(first);
    await applyCouponUI(first, SEED_COUPON.code);
    await expectCouponBound(first);
    await first.context().close();

    const again = await loginAs(ACCOUNTS.normal);
    await openCart(again);
    await expectCartLine(again, 'P1', { unitPrice: 450, qty: 1, available: true });
    await expectCouponBound(again);
  });

  test('E2E-25 [FR-1.2.3, FR-1.2.4, DC-2.13] อยู่ stage ชำระเงินแล้ว login ใหม่ ยังอยู่ที่ออเดอร์เดิมและการจองไม่หลุด', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P2', 3);

    const first = await loginAs(ACCOUNTS.normal);
    await openCart(first);
    const orderId = await checkoutToPaymentUI(first, 'inCity', 'standard');
    await first.context().close();

    // FR-1.2.4: การจองสต็อกไม่เปลี่ยนเพราะการ login -> ลูกค้าอื่นยังไม่เห็น P2
    const other = await loginAs(ACCOUNTS.prime);
    await other.goto(URLS.products);
    await expect(productRow(other, 'P1')).toBeVisible();
    await expect(productRow(other, 'P2')).toHaveCount(0);

    // FR-1.2.3 + DC-2.13: เปิด /cart หรือ /success ต้องได้ page-checkout ของออเดอร์เดิม
    const again = await loginAs(ACCOUNTS.normal);
    for (const url of [URLS.cart, URLS.success, URLS.checkout]) {
      await again.goto(url);
      await expectOnPage(again, 'page-checkout');
      await expectOrderId(again.getByTestId('checkout-order-id'), orderId);
    }

    // ออเดอร์ยัง `รอชำระเงิน` จึงชำระต่อได้
    await paySuccessUI(again);
    await expectOnPage(again, 'page-success');
    await expectOrderId(again.getByTestId('success-order-id'), orderId);
  });

  test('E2E-26 [FR-1.2.3, DC-2.13, FR-6.4] อยู่ stage สำเร็จ: เปิด URL อื่น รีโหลด หรือ login ใหม่ ยังเห็น page-success จนกด continueShopping', async ({ loginAs, given }) => {
    const customer = await given(ACCOUNTS.normal);
    await customer.addItem('P1', 1);
    await customer.pressCheckout('inCity', 'standard');

    const page = await loginAs(ACCOUNTS.normal);
    await page.goto(URLS.checkout);
    await expectOnPage(page, 'page-checkout');
    const orderId = await readOrderId(page.getByTestId('checkout-order-id'));
    await paySuccessUI(page);
    await expectOnPage(page, 'page-success');

    for (const url of [URLS.cart, URLS.checkout]) {
      await page.goto(url);
      await expectOnPage(page, 'page-success');
    }
    await page.reload();
    await expectOnPage(page, 'page-success');
    await page.context().close();

    const again = await loginAs(ACCOUNTS.normal);
    await again.goto(URLS.cart);
    await expectOnPage(again, 'page-success');
    await expectOrderId(again.getByTestId('success-order-id'), orderId);

    await again.getByTestId('continue-shopping-button').click();
    await expectOnPage(again, 'page-cart');
    await expectCartEmpty(again);
  });
});

test.describe('DC-2.12 / DC-2.13 URL ของแต่ละหน้า', () => {
  test('E2E-27 [DC-2.12, DC-2.13] stage ตะกร้า: เปิดหน้าด้วย URL ได้ และ /checkout, /success แสดง page-cart', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    const direct: Array<[string, string]> = [
      [URLS.products, 'page-products'],
      [URLS.cart, 'page-cart'],
      [URLS.orders, 'page-orders'],
    ];
    for (const [url, pageId] of direct) {
      await page.goto(url);
      await expectOnPage(page, pageId);
    }

    for (const url of [URLS.checkout, URLS.success]) {
      await page.goto(url);
      await expectOnPage(page, 'page-cart');
    }
  });

  test('E2E-28 [DC-2.12] Admin เปิดหน้า admin ด้วย URL ได้', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.admin);

    await page.goto(URLS.adminProducts);
    await expectOnPage(page, 'page-admin-products');
    await page.goto(URLS.adminCoupons);
    await expectOnPage(page, 'page-admin-coupons');
  });
});
