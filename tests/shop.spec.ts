import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.getByLabel('ชื่อผู้ใช้').fill(username);
  await page.getByLabel('รหัสผ่าน').fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}

// ตะกร้าเก็บใน database จริง ถ้าไม่ล้าง รันหลายรอบจะชนเพดาน 10 ชิ้นต่อสินค้า
async function clearCart(request: APIRequestContext, username: string, password: string) {
  const loginRes = await request.post('/login', { data: { username, password } });
  expect(loginRes.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await loginRes.json()).accessToken}` };

  const cartRes = await request.get('/cart', { headers });
  expect(cartRes.ok()).toBeTruthy();
  for (const item of (await cartRes.json()).cart.items) {
    const res = await request.delete(`/cart/items/${item.productId}`, { headers });
    // เทสนี้ของแต่ละ browser รันพร้อมกันบนตะกร้าเดียวกัน อีกตัวอาจลบชิ้นนี้ไปก่อนแล้ว
    if (!res.ok()) expect((await res.json()).code).toBe('ITEM_NOT_IN_CART');
  }
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

test('เพิ่มสินค้าลงตะกร้า ตัวเลขตะกร้าต้องเพิ่ม', async ({ page, request }) => {
  await clearCart(request, 'cus_normal', process.env.E2E_PASSWORD!);
  await login(page, 'cus_normal', process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /เพิ่มลงตะกร้า/ }).first().click();
  await expect(page.getByText('ลงตะกร้าเรียบร้อยแล้ว')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตะกร้าสินค้า 1' })).toBeVisible();
});
