import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES, STATUS, URLS } from './support/seed';
import {
  allOrderRows,
  expectAmounts,
  expectMessage,
  expectOnPage,
  expectOrderId,
  expectStatus,
  expectValue,
  orderRow,
} from './support/ui';

// FR-0.5 การมองเห็นออเดอร์, FR-0.6 ลำดับ, FR-5.3.5 ข้อมูลที่บันทึกในออเดอร์

test.describe('FR-0.5 / FR-0.6 ออเดอร์ของ Customer', () => {
  test('E2E-29 [FR-0.6, FR-0.5.1, FR-5.3.5] หน้า orders เรียงจากใหม่ไปเก่า แสดงเฉพาะของตนเอง และดูรายละเอียดได้', async ({ loginAs, given }) => {
    // Given: ออเดอร์ A ถูกยกเลิก แล้วออเดอร์ B (สร้างทีหลัง) ชำระเงินแล้ว
    const customer = await given(ACCOUNTS.normal);
    await customer.addItem('P1', 1);
    const orderA = await customer.pressCheckout('inCity', 'standard');
    await customer.cancelCheckout(orderA); // FR-7.1.3: P1 × 1 กลับเข้าตะกร้า
    const orderB = await customer.pressCheckout('inCity', 'standard');
    await customer.paySuccess(orderB);

    const page = await loginAs(ACCOUNTS.normal);
    // ออกจาก stage สำเร็จผ่านหน้าเว็บก่อน (SOI-2: spec ไม่ได้กำหนดว่าเปิด /orders ระหว่าง stage สำเร็จได้หรือไม่)
    await page.goto(URLS.success);
    await expectOnPage(page, 'page-success');
    await page.getByTestId('continue-shopping-button').click();
    await expectOnPage(page, 'page-cart');

    await page.goto(URLS.orders);
    await expectOnPage(page, 'page-orders');
    await expect(allOrderRows(page)).toHaveCount(2);
    await expect(allOrderRows(page).nth(0)).toHaveAttribute('data-testid', `order-row-${orderB}`);
    await expect(allOrderRows(page).nth(1)).toHaveAttribute('data-testid', `order-row-${orderA}`);
    await expectStatus(orderRow(page, orderB).getByTestId('order-status'), STATUS.order.paid);
    await expectStatus(orderRow(page, orderA).getByTestId('order-status'), STATUS.order.cancelled);
    // 450 + ค่าส่ง light inCity standard 30 = 480 ทั้งสองออเดอร์
    await expectValue(orderRow(page, orderB).getByTestId('order-total'), 480);
    await expectValue(orderRow(page, orderA).getByTestId('order-total'), 480);

    await orderRow(page, orderB).getByTestId('order-view').click();
    await expectOnPage(page, 'page-order-detail');
    await expectOrderId(page.getByTestId('order-detail-id'), orderB);
    await expectStatus(page.getByTestId('order-detail-status'), STATUS.order.paid);
    const line = page.getByTestId('order-line-P1');
    await expectValue(line.getByTestId('order-line-unit-price'), 450);
    await expectValue(line.getByTestId('order-line-qty'), 1);
    await expectAmounts(page, 'order-detail', { subtotal: 450, discount: 0, shipping: 30, total: 480 });

    // FR-0.5.1: ลูกค้าอีกคนไม่เห็นออเดอร์เหล่านี้
    const other = await loginAs(ACCOUNTS.prime);
    await other.goto(URLS.orders);
    await expectOnPage(other, 'page-orders');
    await expect(orderRow(other, orderA)).toHaveCount(0);
    await expect(orderRow(other, orderB)).toHaveCount(0);
    await expect(allOrderRows(other)).toHaveCount(0);
  });

  test('E2E-30 [AC-15: FR-0.5.2] เปิดออเดอร์ของผู้อื่น กับ orderId ที่ไม่มีอยู่ ได้ ORDER_NOT_FOUND เหมือนกัน', async ({ loginAs, given }) => {
    const owner = await given(ACCOUNTS.normal);
    await owner.addItem('P1', 1);
    const orderX = await owner.pressCheckout('inCity', 'standard');

    const page = await loginAs(ACCOUNTS.prime);

    await page.goto(URLS.orderDetail(orderX));
    await expectMessage(page, 'error', CODES.ORDER_NOT_FOUND);
    await expect(page.getByTestId('order-detail-id').filter({ hasText: orderX })).toHaveCount(0);

    await page.goto(URLS.orderDetail('ORDER-THAT-DOES-NOT-EXIST'));
    await expectMessage(page, 'error', CODES.ORDER_NOT_FOUND);
  });
});
