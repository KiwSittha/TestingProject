import { test, expect } from './support/fixtures';
import { ACCOUNTS, CODES } from './support/seed';
import { expectMessage, expectOnPage, submitLogin } from './support/ui';

// FR-0.1 การ login และเมนูตามบทบาท (FR-0.3 ฝั่งหน้าเว็บ, ตาราง 6.2.1)

test.describe('FR-0.1 login', () => {
  test('E2E-01 [FR-0.1.1, FR-0.3.2] Customer login แล้วเห็นเมนูของ Customer ไม่เห็นเมนู Admin', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.normal);

    for (const nav of ['nav-products', 'nav-cart', 'nav-orders']) {
      await expect(page.getByTestId(nav)).toBeVisible();
    }
    for (const nav of ['nav-admin-products', 'nav-admin-coupons']) {
      await expect(page.getByTestId(nav)).toHaveCount(0);
    }
  });

  test('E2E-02 [FR-0.1.1, FR-0.3.1] Admin login แล้วเห็นเมนูของ Admin ไม่เห็นตะกร้าและออเดอร์', async ({ loginAs }) => {
    const page = await loginAs(ACCOUNTS.admin);

    for (const nav of ['nav-admin-products', 'nav-admin-coupons']) {
      await expect(page.getByTestId(nav)).toBeVisible();
    }
    // OP-7 และ OP-13 เป็นของ Customer เท่านั้น
    for (const nav of ['nav-cart', 'nav-orders']) {
      await expect(page.getByTestId(nav)).toHaveCount(0);
    }
  });

  // Equivalence class ของข้อมูล login ที่ไม่ถูกต้อง: username มีอยู่แต่รหัสผิด / username ไม่มีอยู่
  const invalid = [
    { id: 'E2E-03', title: 'รหัสผ่านผิด', username: ACCOUNTS.normal, password: 'wrong-password' },
    { id: 'E2E-04', title: 'ไม่มี username นี้', username: 'no_such_user', password: 'wrong-password' },
  ];

  for (const { id, title, username, password } of invalid) {
    test(`${id} [FR-0.1.2] login ไม่ได้เมื่อ${title}`, async ({ page }) => {
      await submitLogin(page, username, password);

      await expectMessage(page, 'error', CODES.AUTH_INVALID_CREDENTIALS);
      await expectOnPage(page, 'page-login');
      await expect(page.getByTestId('nav-cart')).toHaveCount(0);
      await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
    });
  }
});
