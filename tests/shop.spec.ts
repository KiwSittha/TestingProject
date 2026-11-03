import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByLabel('ชื่อผู้ใช้').fill(username);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}

test('รหัสผ่านผิด ต้องเห็น error และอยู่หน้า login', async ({ page }) => {
  await login(page, 'no_such_user', 'wrong-password');
  await expect(page.getByText('AUTH_INVALID_CREDENTIALS').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ EatSomeWhere' })).toBeVisible();
});

test('login สำเร็จ ต้องเห็นรายการสินค้า', async ({ page }) => {
  await login(page, 'cus_normal', process.env.E2E_PASSWORD!);
  await expect(page.getByText(/พบ \d+ รายการ/)).toBeVisible();
  await expect(page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).first()).toBeVisible();
});

test('เพิ่มสินค้าลงตะกร้า ตัวเลขตะกร้าต้องเพิ่ม', async ({ page }) => {
  await login(page, 'cus_normal', process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).first().click();
  await expect(page.getByText('ลงตะกร้าเรียบร้อยแล้ว')).toBeVisible();
});
