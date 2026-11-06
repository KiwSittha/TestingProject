import { test, expect } from './support/fixtures';
import { ACCOUNTS, URLS } from './support/seed';
import {
  act,
  addItemUI,
  adminProductRow,
  cancelCheckoutUI,
  cartLine,
  checkoutToPaymentUI,
  expectAmounts,
  expectCartEmpty,
  expectCartLine,
  expectMessage,
  expectOnPage,
  expectOrderId,
  expectValue,
  openCart,
  productRow,
} from './support/ui';

// AC ที่ "หน้าเว็บกันไว้ก่อน" จึงทำขั้น When ผ่านปุ่มไม่ได้ หรือทำได้แต่ต้องใส่ค่าที่ผิด
// - AC-1, AC-16: ทำผ่านหน้าเว็บโดยใส่ค่าที่ผิดลงใน input
// - AC-11c, AC-14, AC-17: หน้าเว็บไม่มีปุ่มให้ทำ จึงทำขั้น When เป็นคำสั่งตรงด้วยบัญชีของผู้ใช้คนนั้น
//   แล้วตรวจขั้น Then ผ่านหน้าเว็บ เพื่อยืนยันว่า api-server ปฏิเสธเอง ไม่ได้พึ่งแค่การซ่อนปุ่ม

test.describe('AC ที่หน้าเว็บกันไว้ก่อน', () => {
  test('E2E-35 [AC-1: FR-2.1.2, FR-2.6] เพิ่ม P1 จำนวน 0 ถูกปฏิเสธ QTY_OUT_OF_RANGE และตะกร้ายังว่าง', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    await addItemUI(page, 'P1', 0);

    await expectMessage(page, 'error', 'QTY_OUT_OF_RANGE');
    await openCart(page);
    await expectCartEmpty(page);
  });

  test('E2E-36 [AC-11c: FR-2.2.2] P2 ถูกจองหมด cus_prime เพิ่ม P2 ไม่ได้ (PRODUCT_UNAVAILABLE) และตะกร้ายังว่าง', async ({ loginAs, given }) => {
    const owner = await given(ACCOUNTS.normal);
    await owner.addItem('P2', 3);
    await owner.pressCheckout('inCity', 'standard'); // สต็อกพร้อมขายของ P2 = 0

    const page = await loginAs(ACCOUNTS.prime);
    // ชั้นหน้าเว็บ: P2 ไม่ใช่สินค้าพร้อมขาย จึงไม่แสดงให้กดเพิ่ม
    await page.goto(URLS.products);
    await expect(productRow(page, 'P1')).toBeVisible();
    await expect(productRow(page, 'P2')).toHaveCount(0);

    // When: cus_prime สั่ง addItem(P2, 1) ตรง
    const result = await (await given(ACCOUNTS.prime)).attempt('POST', '/cart/items', { productId: 'P2', quantity: 1 });
    expect(result.body.code).toBe('PRODUCT_UNAVAILABLE');

    await openCart(page);
    await expectCartEmpty(page);
  });

  test('E2E-37 [AC-14: FR-0.3.2] Customer แก้ราคาสินค้าไม่ได้ (AUTH_FORBIDDEN) และราคา P1 ยังเป็น 450', async ({ loginAs, given }) => {
    const page = await loginAs(ACCOUNTS.normal);
    // ชั้นหน้าเว็บ: Customer ไม่มีเมนูของ Admin
    await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);

    // When: cus_normal สั่ง updateProduct(P1, price = 500) ตรง
    const result = await (await given(ACCOUNTS.normal)).attempt('PATCH', '/admin/products/P1/update', { price: 500 });
    expect(result.body.code).toBe('AUTH_FORBIDDEN');

    await page.goto(URLS.products);
    await expectValue(productRow(page, 'P1').getByTestId('product-price'), 450);
  });

  test('E2E-38 [AC-16: FR-9.1.1] Admin ใส่ราคา 0 และสต็อก 10000 ถูกปฏิเสธ VALIDATION_ERROR และ P1 คงเดิม', async ({ loginAs }) => {
    const admin = await loginAs(ACCOUNTS.admin);
    await admin.goto(URLS.adminProducts);
    await expectOnPage(admin, 'page-admin-products');

    const row = adminProductRow(admin, 'P1');
    await row.getByTestId('admin-product-price-input').fill('0');
    await row.getByTestId('admin-product-stock-input').fill('10000');
    await act(admin, row.getByTestId('admin-product-save'));

    await expectMessage(admin, 'error', 'VALIDATION_ERROR');
    await admin.reload();
    await expectValue(adminProductRow(admin, 'P1').getByTestId('admin-product-price'), 450);
    await expectValue(adminProductRow(admin, 'P1').getByTestId('admin-product-stock'), 20);
  });

  test('E2E-39 [AC-17: FR-8.1, FR-8.5.1] อยู่ stage ชำระเงินแล้ว addItem ถูกปฏิเสธ OPERATION_NOT_ALLOWED ตะกร้า stage และสต็อกคงเดิม', async ({ loginAs, given }) => {
    await (await given(ACCOUNTS.normal)).addItem('P2', 1);
    const page = await loginAs(ACCOUNTS.normal);
    await openCart(page);
    const orderId = await checkoutToPaymentUI(page, 'inCity', 'standard');
    // ชั้นหน้าเว็บ: หน้าชำระเงินไม่มีปุ่มหรือช่องเพิ่มสินค้า
    await expect(page.getByTestId('product-add-button')).toHaveCount(0);
    await expect(page.getByTestId('product-add-qty')).toHaveCount(0);

    // When: cus_normal สั่ง addItem(P1, 1) ตรง
    const result = await (await given(ACCOUNTS.normal)).attempt('POST', '/cart/items', { productId: 'P1', quantity: 1 });
    expect(result.body.code).toBe('OPERATION_NOT_ALLOWED');

    // stage คงเดิม: เปิด /cart ยังได้หน้าชำระเงินของออเดอร์เดิมและยอดเดิม (1200 + 30)
    await page.goto(URLS.cart);
    await expectOnPage(page, 'page-checkout');
    await expectOrderId(page.getByTestId('checkout-order-id'), orderId);
    await expectAmounts(page, 'checkout', { subtotal: 1200, discount: 0, shipping: 30, total: 1230 });

    // สต็อกคงเดิม: P1 ยังเป็น 20
    const other = await loginAs(ACCOUNTS.prime);
    await other.goto(URLS.products);
    await expectValue(productRow(other, 'P1').getByTestId('product-stock'), 20);

    // ตะกร้าคงเดิม: ยกเลิกแล้วตะกร้ามีแค่ P2 × 1 ไม่มี P1
    await cancelCheckoutUI(page);
    await expectOnPage(page, 'page-cart');
    await expectCartLine(page, 'P2', { unitPrice: 1200, qty: 1, available: true });
    await expect(cartLine(page, 'P1')).toHaveCount(0);
  });
});
