import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES, MESSAGES, SEED_COUPON, STATUS, URLS } from './support/seed';
import {
  addItemUI,
  cancelCheckoutUI,
  cartLine,
  checkoutToPaymentUI,
  expectAmounts,
  expectCartEmpty,
  expectCartLine,
  expectCouponBound,
  expectInfoMessage,
  expectMessage,
  expectOnPage,
  expectOrderId,
  expectStatus,
  expectValue,
  openCart,
  orderRow,
  payFailUI,
  paySuccessUI,
  pressCheckoutUI,
  productRow,
  removeItemUI,
} from './support/ui';

// FR-5 เข้าสู่ขั้นตอนชำระเงิน, FR-6 การชำระเงิน, FR-7 การยกเลิก
// และกรณีข้าม actor ที่ต้องเห็นผลบนหน้าจอของอีกบัญชี (FR-0.4, FR-5.3.7, FR-9.3.4)

test.describe('FR-5/6 เส้นทางหลัก', () => {
  test('E2E-19 [AC-18a, AC-18b: FR-5.3, FR-6.1, FR-6.4, FR-0.5.1, FR-5.3.10] ซื้อ P1 × 1 จนชำระเงินสำเร็จ แล้วกลับมาซื้อต่อ', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    await addItemUI(page, 'P1', 1);
    await openCart(page);
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    const orderId = await checkoutToPaymentUI(page, 'inCity', 'standard');
    // 450, normal ไม่มีส่วนลด, 300 กรัม light inCity standard = 30, total 480
    const amounts = { subtotal: 450, discount: 0, shipping: 30, total: 480 };
    await expectAmounts(page, 'checkout', amounts);

    await paySuccessUI(page);

    // FR-6.1.3, FR-6.1.4
    await expectOnPage(page, 'page-success');
    await expectOrderId(page.getByTestId('success-order-id'), orderId);
    await expect(page.getByTestId('success-line-P1')).toBeVisible();
    await expectAmounts(page, 'success', amounts);

    // FR-6.4 + FR-6.1.2: กลับสู่ stage ตะกร้าที่ว่างและไม่มีคูปอง
    await page.getByTestId('continue-shopping-button').click();
    await expectOnPage(page, 'page-cart');
    await expectCartEmpty(page);
    await expect(page.getByTestId('checkout-button')).toBeDisabled();

    // FR-0.5.1, FR-6.1.1
    await page.goto(URLS.orders);
    await expectOnPage(page, 'page-orders');
    await expectStatus(orderRow(page, orderId).getByTestId('order-status'), STATUS.order.paid);
    await expectValue(orderRow(page, orderId).getByTestId('order-total'), 480);

    // FR-5.3.7 + FR-5.3.10: จองไว้ 1 ชิ้นและชำระแล้ว สต็อกพร้อมขายจึงเหลือ 20 − 1 = 19
    await page.goto(URLS.products);
    await expectValue(productRow(page, 'P1').getByTestId('product-stock'), 19);
  });

  test('E2E-20 [FR-6.2.1, FR-6.2.2, FR-6.3] ชำระเงินล้มเหลวสองครั้ง ยังอยู่ที่ออเดอร์เดิม แล้วชำระสำเร็จได้', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P1', 2);
    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);

    const orderId = await checkoutToPaymentUI(page, 'upcountry', 'express');
    // 900, น้ำหนัก 600 light, upcountry base 50, normal + express = 50 × 3/2 = 75, total 975
    const amounts = { subtotal: 900, discount: 0, shipping: 75, total: 975 };
    await expectAmounts(page, 'checkout', amounts);

    for (let attempt = 1; attempt <= 2; attempt++) {
      await payFailUI(page);
      await expectInfoMessage(page, MESSAGES.payFail);
      await expectOnPage(page, 'page-checkout');
      await expectOrderId(page.getByTestId('checkout-order-id'), orderId);
      await expectAmounts(page, 'checkout', amounts);
    }

    await paySuccessUI(page);
    await expectOnPage(page, 'page-success');
    await expectOrderId(page.getByTestId('success-order-id'), orderId);
    await expectAmounts(page, 'success', amounts);
  });
});

test.describe('FR-7 ยกเลิกการชำระเงิน', () => {
  test('E2E-21 [FR-7.1, FR-7.2.1, FR-7.3, AC-11a, AC-12] ยกเลิกแล้วได้ตะกร้าและคูปองเดิม สต็อกคืน และ checkout ใหม่ได้ orderId ใหม่', async ({ loginAs, given }) => {
    const customer = await given(ACCOUNTS.normal);
    await customer.addItem('P2', 3);
    await customer.applyCoupon(SEED_COUPON.code);
    const page = await loginAs(ACCOUNTS.normal);
    const other = await loginAs(ACCOUNTS.prime);

    await openCart(page);
    const firstOrderId = await checkoutToPaymentUI(page, 'inCity', 'standard');
    // 1200 × 3 = 3600 ≥ 1000 -> ส่วนลด 360, น้ำหนัก 2700 medium inCity standard = 50, total 3290
    await expectAmounts(page, 'checkout', { subtotal: 3600, discount: 360, shipping: 50, total: 3290 });

    // AC-11a: P2 ถูกจองครบ 3 ชิ้น สต็อกพร้อมขาย = 0 -> ไม่ใช่สินค้าพร้อมขาย ลูกค้าอีกคนไม่เห็น
    await other.goto(URLS.products);
    await expect(productRow(other, 'P1')).toBeVisible();
    await expect(productRow(other, 'P2')).toHaveCount(0);

    await cancelCheckoutUI(page);

    // FR-7.1.3, FR-7.2.1
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P2', { unitPrice: 1200, qty: 3, available: true });
    await expectCouponBound(page);
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    // FR-7.1.2: คืน 3 ชิ้น สต็อกพร้อมขาย P2 = 0 + 3 = 3
    await other.reload();
    await expectValue(productRow(other, 'P2').getByTestId('product-stock'), 3);

    // FR-7.1.1
    await page.goto(URLS.orders);
    await expectStatus(orderRow(page, firstOrderId).getByTestId('order-status'), STATUS.order.cancelled);

    // FR-7.3.2
    await openCart(page);
    const secondOrderId = await checkoutToPaymentUI(page, 'inCity', 'standard');
    expect(secondOrderId).not.toBe(firstOrderId);
  });
});

test.describe('ข้าม actor ณ checkout', () => {
  test('E2E-22 [AC-11b: FR-5.2.1, FR-2.9, FR-0.7] สต็อก P2 ถูกลูกค้าอื่นจองหมด cus_prime checkout ไม่ได้', async ({ loginAs, given }) => {
    // Given: cus_prime มี P2 × 1 ก่อน แล้ว cus_normal จอง P2 × 3
    await (await given(ACCOUNTS.prime)).addItem('P2', 1);
    const normal = await given(ACCOUNTS.normal);
    await normal.addItem('P2', 3);
    await normal.pressCheckout('inCity', 'standard');

    const page = await loginAs(ACCOUNTS.prime);
    await openCart(page);
    // สต็อกพร้อมขาย 0 -> แถวยังอยู่แต่ไม่ใช่สินค้าพร้อมขาย, ปุ่มยังเปิดเพราะมี 1 รายการและอยู่ stage ตะกร้า (FR-2.8)
    await expectCartLine(page, 'P2', { unitPrice: 1200, qty: 1, available: false });
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    await pressCheckoutUI(page, 'inCity', 'standard');

    await expectMessage(page, 'error', CODES.ITEMS_UNAVAILABLE);
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P2', { unitPrice: 1200, qty: 1, available: false });

    // AC-11c ทางหน้าเว็บ: P2 ไม่แสดงในรายการสินค้า จึงเพิ่มเข้าตะกร้าไม่ได้ (การยิง addItem ตรงอยู่ในระดับ service)
    await page.goto(URLS.products);
    await expect(productRow(page, 'P1')).toBeVisible();
    await expect(productRow(page, 'P2')).toHaveCount(0);
  });

  test('E2E-23 [AC-10: FR-5.2.1, FR-9.3.4, FR-2.7.3] admin ปิดขาย P1 ที่อยู่ในตะกร้า checkout ไม่ได้ แต่ลบออกได้', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P1', 1);
    await (await given(ACCOUNTS.admin)).setProductStatus('P1', 'ปิดขาย');

    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 1, available: false }); // FR-9.3.4

    await pressCheckoutUI(page, 'inCity', 'standard');
    await expectMessage(page, 'error', CODES.ITEMS_UNAVAILABLE);
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 1, available: false });

    // FR-2.7.3: ลบได้แม้ไม่ใช่สินค้าพร้อมขาย
    await removeItemUI(page, 'P1');
    await expectInfoMessage(page, MESSAGES.cartEmpty);
    await expect(cartLine(page, 'P1')).toHaveCount(0);
  });
});
