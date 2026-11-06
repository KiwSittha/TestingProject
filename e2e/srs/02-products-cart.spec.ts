import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES, MESSAGES, SEED_PRODUCTS, URLS } from './support/seed';
import {
  addItemUI,
  allOrderRows,
  expectCartEmpty,
  expectCartLine,
  expectInfoMessage,
  expectMessage,
  expectNoCouponBound,
  expectOnPage,
  expectValue,
  openCart,
  productRow,
  removeItemUI,
  updateQuantityUI,
} from './support/ui';

// FR-1 สถานะเริ่มต้นและการดูสินค้า, FR-2 การจัดการตะกร้า
// ค่าขอบเขตทั้งหมดของ quantity (BVA/ECT) อยู่ในระดับ unit และ service
// ที่นี่ตรวจเฉพาะว่าหน้าเว็บส่งคำสั่งได้และแสดงผล/ข้อผิดพลาดตามที่ spec กำหนด

test.describe('FR-1 สถานะเริ่มต้นและรายการสินค้า', () => {
  test('E2E-05 [FR-1.1, FR-2.8] Customer ที่ยังไม่เคยใช้งาน: ตะกร้าว่าง ไม่มีคูปอง ปุ่มชำระเงินปิด ไม่มีออเดอร์', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    await openCart(page); // stage `ตะกร้า` จึงต้องแสดง page-cart
    await expectCartEmpty(page);
    await expectNoCouponBound(page);
    await expect(page.getByTestId('checkout-button')).toBeDisabled();

    await page.goto(URLS.orders);
    await expectOnPage(page, 'page-orders');
    await expect(allOrderRows(page)).toHaveCount(0);
  });

  test('E2E-06 [FR-1.3.1] Customer เห็นเฉพาะสินค้าพร้อมขาย พร้อมชื่อ ราคา และสต็อก', async ({ loginAs, given }) => {
    const page = await loginAs(ACCOUNTS.normal);
    await page.goto(URLS.products);
    await expectOnPage(page, 'page-products');

    for (const [id, product] of Object.entries(SEED_PRODUCTS)) {
      const row = productRow(page, id as keyof typeof SEED_PRODUCTS);
      await expect(row.getByTestId('product-name')).toHaveText(product.name);
      await expectValue(row.getByTestId('product-price'), product.price);
      await expectValue(row.getByTestId('product-stock'), product.stock);
    }

    // Given: admin ปิดขาย P2 -> P2 ไม่ใช่สินค้าพร้อมขาย
    await (await given(ACCOUNTS.admin)).setProductStatus('P2', 'ปิดขาย');

    await page.reload();
    await expectValue(productRow(page, 'P1').getByTestId('product-price'), 450);
    await expect(productRow(page, 'P2')).toHaveCount(0);
  });
});

test.describe('FR-2 การจัดการตะกร้า', () => {
  test('E2E-07 [FR-2.3.1, FR-2.3.2, FR-2.8, FR-2.9] เพิ่มสินค้าใหม่ แล้วเพิ่มสินค้าเดิมซ้ำ quantity ต้องรวมกันในแถวเดียว', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    await addItemUI(page, 'P1', 2);
    await openCart(page);
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 2, available: true });
    await expect(page.getByTestId('cart-line-P1').getByTestId('cart-line-name')).toHaveText(SEED_PRODUCTS.P1.name);
    await expectValue(page.getByTestId('cart-subtotal'), 900); // 450 × 2
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    await addItemUI(page, 'P1', 3);
    await openCart(page);
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 5, available: true }); // 2 + 3
    await expectValue(page.getByTestId('cart-subtotal'), 2250); // 450 × 5
  });

  test('E2E-08 [AC-2: FR-2.4.1, FR-0.7] เพิ่ม P1 อีก 3 ขณะมี 8 ถูกปฏิเสธ QTY_OUT_OF_RANGE และ quantity คง 8', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P1', 8);
    const page = await loginAs(ACCOUNTS.normal);

    await addItemUI(page, 'P1', 3);
    await expectMessage(page, 'error', CODES.QTY_OUT_OF_RANGE);

    await openCart(page);
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 8, available: true });
  });

  test('E2E-09 [AC-3: FR-2.4.2, FR-0.7] เพิ่ม P2 อีก 2 ขณะมี 2 (สต็อก 3) ถูกปฏิเสธ INSUFFICIENT_STOCK และ quantity คง 2', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P2', 2);
    const page = await loginAs(ACCOUNTS.normal);

    await addItemUI(page, 'P2', 2);
    await expectMessage(page, 'error', CODES.INSUFFICIENT_STOCK);

    await openCart(page);
    await expectCartLine(page, 'P2', { unitPrice: 1200, qty: 2, available: true });
  });

  test('E2E-10 [FR-2.5.6, FR-4.1] แก้ quantity ในตะกร้า แทนที่ด้วยค่าใหม่', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P1', 2);
    const page = await loginAs(ACCOUNTS.normal);

    await openCart(page);
    await updateQuantityUI(page, 'P1', 4);

    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 4, available: true });
    await expectValue(page.getByTestId('cart-subtotal'), 1800); // 450 × 4
  });

  test('E2E-11 [FR-2.7.3, FR-2.7.4, FR-2.8] ลบทีละรายการจนตะกร้าว่าง แสดง "ตะกร้าว่าง" และปุ่มชำระเงินปิด', async ({ loginAs, given }) => {
    const customer = await given(ACCOUNTS.normal);
    await customer.addItem('P1', 1);
    await customer.addItem('P2', 1);
    const page = await loginAs(ACCOUNTS.normal);

    await openCart(page);
    await removeItemUI(page, 'P2');
    await expectValue(page.getByTestId('cart-subtotal'), 450);
    await expect(page.getByTestId('cart-line-P2')).toHaveCount(0);
    await expectCartLine(page, 'P1', { unitPrice: 450, qty: 1, available: true });
    await expect(page.getByTestId('checkout-button')).toBeEnabled();

    await removeItemUI(page, 'P1');
    await expectInfoMessage(page, MESSAGES.cartEmpty);
    await expectCartEmpty(page);
    await expect(page.getByTestId('checkout-button')).toBeDisabled();
  });
});
