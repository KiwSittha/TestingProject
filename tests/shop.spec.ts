import { test, expect } from '@playwright/test';
import { CUSTOMER, ShopApi, addToCartUI, loginUI } from './helpers';

test('รหัสผ่านผิด ต้องเห็น error และอยู่หน้า login', async ({ page }) => {
  await loginUI(page, 'no_such_user', 'wrong-password');
  await expect(page.getByText('AUTH_INVALID_CREDENTIALS').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ EatSomeWhere' })).toBeVisible();
});

test('login สำเร็จ ต้องเห็นรายการสินค้า', async ({ page }) => {
  await loginUI(page, CUSTOMER);
  await expect(page.getByText(/พบ \d+ รายการ/)).toBeVisible();
  await expect(page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).first()).toBeVisible();
});

test('เพิ่มสินค้าลงตะกร้า ตัวเลขตะกร้าต้องเพิ่ม', async ({ page, request }) => {
  // ตะกร้าเก็บใน database จริง ถ้าไม่ล้าง รันหลายรอบจะชนเพดาน 10 ชิ้นต่อสินค้า
  await (await ShopApi.login(request)).clearCart();
  await loginUI(page, CUSTOMER);
  await addToCartUI(page, 'P1', 1);
  await expect(page.getByText('ลงตะกร้าเรียบร้อยแล้ว')).toBeVisible();
});
