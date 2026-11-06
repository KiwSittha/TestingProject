import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES, SEED_COUPON, SEED_PRODUCTS, STATUS, URLS } from './support/seed';
import {
  act,
  adminCouponRow,
  adminProductRow,
  applyCouponUI,
  expectAmounts,
  expectCartLine,
  expectMessage,
  expectNoCouponBound,
  expectOnPage,
  expectStatus,
  expectValue,
  openCart,
  productRow,
} from './support/ui';

// FR-9 จัดการสินค้า, FR-10 จัดการคูปอง ผ่านหน้า Admin และผลที่ฝั่ง Customer เห็น (ข้าม actor)
// การตรวจช่วงค่าของ price/stock (AC-16, BVA) อยู่ในระดับ unit และ service

async function openAdminProducts(page: Page) {
  await page.goto(URLS.adminProducts);
  await expectOnPage(page, 'page-admin-products');
}

test.describe('FR-9 การจัดการสินค้า', () => {
  test('E2E-31 [FR-1.3.2, FR-9.3.2, FR-1.3.1] Admin เห็นสินค้าทั้งหมดรวมที่ปิดขาย และการปิด/เปิดขายมีผลกับรายการของ Customer', async ({ loginAs }) => {
    const admin = await loginAs(ACCOUNTS.admin);
    const customer = await loginAs(ACCOUNTS.normal);
    await openAdminProducts(admin);

    for (const [id, product] of Object.entries(SEED_PRODUCTS)) {
      const row = adminProductRow(admin, id as keyof typeof SEED_PRODUCTS);
      await expectValue(row.getByTestId('admin-product-price'), product.price);
      await expectValue(row.getByTestId('admin-product-stock'), product.stock);
      await expectStatus(row.getByTestId('admin-product-status'), STATUS.product.onSale);
    }

    const p3 = adminProductRow(admin, 'P3');
    await act(admin, p3.getByTestId('admin-product-toggle-status'));
    await expectStatus(p3.getByTestId('admin-product-status'), STATUS.product.offSale);
    await admin.reload();
    await expectStatus(adminProductRow(admin, 'P3').getByTestId('admin-product-status'), STATUS.product.offSale); // ยังแสดงแม้ปิดขาย

    await customer.goto(URLS.products);
    await expect(productRow(customer, 'P1')).toBeVisible();
    await expect(productRow(customer, 'P3')).toHaveCount(0);

    await act(admin, adminProductRow(admin, 'P3').getByTestId('admin-product-toggle-status'));
    await expectStatus(adminProductRow(admin, 'P3').getByTestId('admin-product-status'), STATUS.product.onSale);

    await customer.reload();
    await expectValue(productRow(customer, 'P3').getByTestId('product-price'), 15000);
  });

  test('E2E-32 [FR-9.1.2] Admin แก้ราคาและสต็อก แล้ว Customer เห็นค่าใหม่', async ({ loginAs }) => {
    const admin = await loginAs(ACCOUNTS.admin);
    await openAdminProducts(admin);

    const row = adminProductRow(admin, 'P1');
    await row.getByTestId('admin-product-price-input').fill('500');
    await row.getByTestId('admin-product-stock-input').fill('15');
    await act(admin, row.getByTestId('admin-product-save'));
    await expectValue(row.getByTestId('admin-product-price'), 500);
    await expectValue(row.getByTestId('admin-product-stock'), 15);

    const customer = await loginAs(ACCOUNTS.normal);
    await customer.goto(URLS.products);
    await expectValue(productRow(customer, 'P1').getByTestId('product-price'), 500);
    await expectValue(productRow(customer, 'P1').getByTestId('product-stock'), 15);
  });

  test('E2E-33 [AC-13: FR-5.3.6, FR-9.2.1, FR-9.2.2] แก้ราคา P1 เป็น 500 ออเดอร์ที่รอชำระยังเป็น 450 แต่ตะกร้าเป็น 500', async ({ loginAs, given }) => {
    const owner = await given(ACCOUNTS.normal);
    await owner.addItem('P1', 1);
    await owner.pressCheckout('inCity', 'standard');
    await (await given(ACCOUNTS.prime)).addItem('P1', 1);

    const admin = await loginAs(ACCOUNTS.admin);
    await openAdminProducts(admin);
    const row = adminProductRow(admin, 'P1');
    await row.getByTestId('admin-product-price-input').fill('500');
    await act(admin, row.getByTestId('admin-product-save'));
    await expectValue(row.getByTestId('admin-product-price'), 500);

    // ออเดอร์ของ cus_normal (stage ชำระเงิน) ยังเป็นราคา ณ ตอน checkout
    const ownerPage = await loginAs(ACCOUNTS.normal);
    await ownerPage.goto(URLS.checkout);
    await expectOnPage(ownerPage, 'page-checkout');
    await expectAmounts(ownerPage, 'checkout', { subtotal: 450, discount: 0, shipping: 30, total: 480 });

    // ตะกร้าของ cus_prime ใช้ราคาปัจจุบัน
    const cartPage = await loginAs(ACCOUNTS.prime);
    await openCart(cartPage);
    await expectCartLine(cartPage, 'P1', { unitPrice: 500, qty: 1, available: true });
    await expectValue(cartPage.getByTestId('cart-subtotal'), 500);
  });
});

test.describe('FR-10 การจัดการคูปอง', () => {
  test('E2E-34 [AC-19a, AC-19b, FR-10.2, FR-3.1.2] Admin ปิด SAVE10 หน้า coupons แสดงสถานะใหม่ และ Customer ผูกคูปองไม่ได้', async ({ loginAs }) => {
    const admin = await loginAs(ACCOUNTS.admin);
    await admin.goto(URLS.adminCoupons);
    await expectOnPage(admin, 'page-admin-coupons');

    const row = adminCouponRow(admin, SEED_COUPON.code);
    await expectValue(row.getByTestId('admin-coupon-percent'), SEED_COUPON.percent);
    await expectValue(row.getByTestId('admin-coupon-min-spend'), SEED_COUPON.minSpend);
    await expectStatus(row.getByTestId('admin-coupon-status'), STATUS.coupon.active);

    await act(admin, row.getByTestId('admin-coupon-toggle-status'));
    await expectStatus(row.getByTestId('admin-coupon-status'), STATUS.coupon.inactive);

    // AC-19b: listCoupons ครั้งถัดไปต้องแสดงค่าเดิมครบและสถานะ ปิดใช้
    await admin.reload();
    const reloaded = adminCouponRow(admin, SEED_COUPON.code);
    await expectValue(reloaded.getByTestId('admin-coupon-percent'), 10);
    await expectValue(reloaded.getByTestId('admin-coupon-min-spend'), 1000);
    await expectStatus(reloaded.getByTestId('admin-coupon-status'), STATUS.coupon.inactive);

    const customer = await loginAs(ACCOUNTS.normal);
    await openCart(customer);
    await applyCouponUI(customer, SEED_COUPON.code);
    await expectMessage(customer, 'error', CODES.COUPON_INVALID);
    await expectValue(customer.getByTestId('cart-subtotal'), 0);
    await expectNoCouponBound(customer);
  });
});
