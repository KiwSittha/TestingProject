import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES, MESSAGES, SEED_COUPON } from './support/seed';
import {
  addItemUI,
  applyCouponUI,
  cancelCheckoutUI,
  checkoutToPaymentUI,
  expectAmounts,
  expectCartLine,
  expectCartEmpty,
  expectCouponBound,
  expectMessage,
  expectNoCouponBound,
  expectOnPage,
  expectValue,
  openCart,
  pressCheckoutUI,
} from './support/ui';

// FR-3 คูปอง และ FR-4 การคำนวณราคา ตามที่หน้าเว็บแสดง
// ทุก combination ของ Decision Table (FR-4.2–4.4) และ pairwise ค่าจัดส่ง (FR-4.5–4.7) อยู่ในระดับ unit
// ที่นี่ใช้ AC ของ spec เป็นตัวแทน เพื่อยืนยันว่าหน้าจอแสดงผลการคำนวณของ api-server ครบทุกส่วน

test.describe('FR-3 การผูกคูปอง', () => {
  test('E2E-12 [FR-3.1.1, FR-3.1.2, FR-3.2.1, FR-3.2.3] code ตัวพิมพ์ไม่ตรงถูกปฏิเสธ COUPON_INVALID, code ถูกต้องผูกได้แม้ตะกร้าว่าง', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);

    await applyCouponUI(page, 'save10'); // case-sensitive: ไม่ตรงกับ SAVE10
    await expectMessage(page, 'error', CODES.COUPON_INVALID);
    await expectCartEmpty(page);
    await expectNoCouponBound(page);

    await applyCouponUI(page, SEED_COUPON.code);
    await expectCouponBound(page);
  });
});

test.describe('FR-4 การคำนวณราคา ณ pressCheckout', () => {
  test('E2E-13 [AC-4: FR-4.2.1, FR-4.2.2, FR-4.7, FR-4.8] cus_prime P1+P2 + SAVE10, inCity/standard', async ({ loginAs }) => {
    // ทำทุกขั้นผ่านหน้าเว็บ: เพิ่มสินค้า -> ผูกคูปอง -> checkout
    const page = await loginAs(ACCOUNTS.prime);
    await addItemUI(page, 'P1', 1);
    await addItemUI(page, 'P2', 1);
    await openCart(page);
    await applyCouponUI(page, SEED_COUPON.code);
    await expectCouponBound(page);
    await expectValue(page.getByTestId('cart-subtotal'), 1650);

    await checkoutToPaymentUI(page, 'inCity', 'standard');

    // subtotal 450 + 1200 = 1650 ≥ minSpend 1000 -> ส่วนลดคูปอง floor(1650 × 10 / 100) = 165 (ไม่ทบส่วนลดสมาชิก)
    // น้ำหนัก 300 + 900 = 1200 -> medium, inCity base 50, prime + standard = 0
    // total 1650 − 165 + 0 = 1485
    await expectAmounts(page, 'checkout', { subtotal: 1650, discount: 165, shipping: 0, total: 1485 });
  });

  test('E2E-14 [AC-5: FR-4.4.1, การปัดเศษ] cus_prime P1+P2 ไม่มีคูปอง, inCity/standard', async ({ loginAs, given }) => {
    const prime = await given(ACCOUNTS.prime);
    await prime.addItem('P1', 1);
    await prime.addItem('P2', 1);
    const page = await loginAs(ACCOUNTS.prime);
    await openCart(page);

    await checkoutToPaymentUI(page, 'inCity', 'standard');

    // ส่วนลดสมาชิก floor(1650 × 5 / 100) = floor(82.5) = 82, ค่าส่ง 0, total 1650 − 82 + 0 = 1568
    await expectAmounts(page, 'checkout', { subtotal: 1650, discount: 82, shipping: 0, total: 1568 });
  });

  test('E2E-15 [AC-6: FR-4.3.1, FR-4.3.2, FR-4.4.1; FR-7.2.2] คูปองถูกถอดเพราะยอดไม่ถึง minSpend และไม่ถูกผูกกลับหลังยกเลิก', async ({ loginAs, given }) => {
    const prime = await given(ACCOUNTS.prime);
    await prime.addItem('P1', 2);
    await prime.applyCoupon(SEED_COUPON.code); // FR-3.2.2: ผูกได้โดยไม่ตรวจยอดขั้นต่ำ
    const page = await loginAs(ACCOUNTS.prime);
    await openCart(page);

    await checkoutToPaymentUI(page, 'upcountry', 'express');

    await expectMessage(page, 'notice', CODES.COUPON_NOT_APPLICABLE, MESSAGES.couponNotApplicable);
    // subtotal 900 < 1000 -> ถอดคูปอง, ส่วนลดสมาชิก floor(900 × 5 / 100) = 45
    // น้ำหนัก 600 -> light, upcountry base 50, prime + express = 50 × 1/2 = 25
    // total 900 − 45 + 25 = 880
    await expectAmounts(page, 'checkout', { subtotal: 900, discount: 45, shipping: 25, total: 880 });

    await cancelCheckoutUI(page);
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 2, available: true });
    await expectNoCouponBound(page); // FR-7.2.2
  });

  test('E2E-16 [AC-7: FR-4.3.1, FR-4.3.2, FR-4.4.2, FR-10.1.3] admin ปิด SAVE10 หลังลูกค้าผูกแล้ว คูปองถูกถอดตอน checkout', async ({ loginAs, given }) => {
    const customer = await given(ACCOUNTS.normal);
    await customer.addItem('P2', 1);
    await customer.applyCoupon(SEED_COUPON.code);
    await (await given(ACCOUNTS.admin)).setCouponStatus(SEED_COUPON.code, 'ปิดใช้');

    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);
    await expectValue(page.getByTestId('cart-subtotal'), 1200);
    // FR-10.1.3 + FR-5.2.2: การปิดคูปองมีผล ณ pressCheckout ครั้งถัดไป ก่อนกดคูปองจึงยังผูกอยู่ (FR-2.9)
    // ใช้ soft เพื่อให้ตรวจ AC-7 ต่อได้แม้ข้อนี้ไม่ผ่าน
    await expect.soft(page.getByTestId('cart-coupon-code')).toHaveText(new RegExp(`\\b${SEED_COUPON.code}\\b`));

    await checkoutToPaymentUI(page, 'inCity', 'standard');

    await expectMessage(page, 'notice', CODES.COUPON_NOT_APPLICABLE, MESSAGES.couponNotApplicable);
    // normal ไม่มีส่วนลดสมาชิก, น้ำหนัก 900 -> light, inCity standard = 30, total 1200 − 0 + 30 = 1230
    await expectAmounts(page, 'checkout', { subtotal: 1200, discount: 0, shipping: 30, total: 1230 });
  });

  test('E2E-17 [AC-8: FR-4.5, FR-4.7] cus_normal P3 × 1, remote/express', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P3', 1);
    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);

    await checkoutToPaymentUI(page, 'remote', 'express');

    // น้ำหนัก 8000 -> heavy, remote base 180, normal + express = 180 × 3/2 = 270, total 15000 + 270 = 15270
    await expectAmounts(page, 'checkout', { subtotal: 15000, discount: 0, shipping: 270, total: 15270 });
  });

  test('E2E-18 [AC-9: FR-5.2.1, FR-0.7] น้ำหนักรวม 24,000 กรัม ถูกปฏิเสธ WEIGHT_LIMIT_EXCEEDED และยังอยู่ที่ตะกร้า', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P3', 3);
    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);

    await pressCheckoutUI(page, 'inCity', 'standard');

    await expectMessage(page, 'error', CODES.WEIGHT_LIMIT_EXCEEDED);
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P3', { unitPrice: 15000, qty: 3, available: true });
    await expect(page.getByTestId('checkout-button')).toBeEnabled(); // stage ยังเป็น `ตะกร้า` (FR-2.8)
  });
});
