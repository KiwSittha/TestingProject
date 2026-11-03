import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// /orders และ /admin ไม่ได้ proxy ผ่าน vite จึงเรียก backend ตรง
export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export const CUSTOMER = 'cus_normal';
export const ADMIN = 'admin01';

// ค่าตั้งต้นของข้อมูลทดสอบ ทุกเทสเริ่มจากค่านี้ (ดู resetTestData)
export const PRODUCTS = {
  P1: { name: 'Coffee Beans 250g', price: 450, stock: 20 },
  P2: { name: 'Drip Kettle', price: 1200, stock: 3 },
  P3: { name: 'Espresso Machine', price: 15000, stock: 5 },
} as const;
export type ProductId = keyof typeof PRODUCTS;

export const COUPON = { code: 'SAVE10', percent: 10, minSpend: 1000 } as const;

function password(): string {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is not set (.env or CI secret)');
  return value;
}

// ---------- API: ใช้เตรียม precondition และตรวจผลฝั่ง backend ----------

export class ShopApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly headers: Record<string, string>
  ) {}

  static async login(request: APIRequestContext, username = CUSTOMER): Promise<ShopApi> {
    const res = await request.post(`${API_URL}/login`, { data: { username, password: password() } });
    expect(res.ok(), `login ${username}`).toBeTruthy();
    const { accessToken } = await res.json();
    return new ShopApi(request, { Authorization: `Bearer ${accessToken}` });
  }

  async call(method: string, path: string, data?: unknown) {
    const res = await this.request.fetch(`${API_URL}${path}`, { method, headers: this.headers, data });
    return { status: res.status(), body: await res.json().catch(() => ({})) };
  }

  private async ok(method: string, path: string, data?: unknown) {
    const { status, body } = await this.call(method, path, data);
    expect(status, `${method} ${path} -> ${JSON.stringify(body)}`).toBe(200);
    return body;
  }

  async cart() {
    return (await this.ok('GET', '/cart')).cart;
  }

  async quantityInCart(productId: ProductId): Promise<number> {
    const item = (await this.cart()).items.find((i: { productId: string }) => i.productId === productId);
    return item?.quantity ?? 0;
  }

  async addToCart(productId: ProductId, quantity: number) {
    return this.ok('POST', '/cart/items', { productId, quantity });
  }

  async clearCart() {
    for (const item of (await this.cart()).items) {
      await this.ok('DELETE', `/cart/items/${item.productId}`);
    }
  }

  async orders() {
    return (await this.ok('GET', '/orders')).orders;
  }

  async checkout(zone = 'bangkok', speed = 'standard') {
    return (await this.ok('POST', '/orders/new/payment', { zone, speed })).order;
  }

  async pay(orderId: string, result: 'success' | 'fail') {
    return (await this.ok('POST', `/orders/${orderId}/payment`, { orderId, result })).order;
  }

  async cancelPendingOrders() {
    for (const order of await this.orders()) {
      if (order.status === 'รอชำระเงิน') await this.ok('POST', `/orders/${order.id}/cancel`);
    }
  }

  async stock(productId: ProductId): Promise<number> {
    const products = (await this.ok('GET', '/list')).products;
    return products.find((p: { id: string }) => p.id === productId).available_stock;
  }

  async setProductStatus(productId: ProductId, status: 'เปิดขาย' | 'ปิดขาย') {
    return this.ok('PATCH', `/admin/products/${productId}/set`, { status });
  }
}

// เทสเขียนลง database จริง จึงต้องตั้งข้อมูลกลับเป็นค่าตั้งต้นก่อนทุกเทส
export async function resetTestData(request: APIRequestContext) {
  const admin = await ShopApi.login(request, ADMIN);
  for (const [id, product] of Object.entries(PRODUCTS)) {
    await admin.call('PATCH', `/admin/products/${id}/update`, { price: product.price, stock: product.stock });
    await admin.setProductStatus(id as ProductId, 'เปิดขาย');
  }
  await admin.call('PATCH', `/admin/coupons/${COUPON.code}/set`, { status: 1 });

  const customer = await ShopApi.login(request, CUSTOMER);
  await customer.cancelPendingOrders();
  await customer.clearCart();
  return customer;
}

// ---------- UI ----------

export async function loginUI(page: Page, username = CUSTOMER, pass = password()) {
  await page.goto('/');
  await page.getByLabel('ชื่อผู้ใช้').fill(username);
  await page.getByLabel('รหัสผ่าน').fill(pass);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}

export function cartButton(page: Page, count: number): Locator {
  return page.getByRole('button', { name: `ตะกร้าสินค้า ${count}`, exact: true });
}

export function productCard(page: Page, productId: ProductId): Locator {
  return page
    .getByRole('heading', { name: PRODUCTS[productId].name, exact: true })
    .locator('xpath=ancestor::div[.//button][1]');
}

export async function clickAddToCart(page: Page, productId: ProductId) {
  await productCard(page, productId).getByRole('button').click();
}

// กดเพิ่มแล้วรอจนตัวเลขตะกร้าบนหัวเว็บเป็น expectedCount
export async function addToCartUI(page: Page, productId: ProductId, expectedCount: number) {
  await clickAddToCart(page, productId);
  await expect(cartButton(page, expectedCount)).toBeVisible();
}

export function cartRow(page: Page, productId: ProductId): Locator {
  return page
    .getByRole('heading', { name: PRODUCTS[productId].name, exact: true })
    .locator('xpath=ancestor::div[.//button[@title="ลบรายการ"]][1]');
}

// ---------- ส่วนที่หน้าเว็บยังไม่มี: ตั้งชื่อ locator ไว้ตาม docs/e2e-design.md ----------

export async function applyCouponUI(page: Page, code: string) {
  await expect(page.getByLabel('รหัสคูปอง')).toBeVisible();
  await page.getByLabel('รหัสคูปอง').fill(code);
  await page.getByRole('button', { name: 'ใช้คูปอง' }).click();
}

export async function checkoutUI(page: Page, zone: 'กรุงเทพ' | 'ต่างจังหวัด', speed: 'ปกติ' | 'ด่วน') {
  await page.getByRole('button', { name: /ดำเนินการชำระเงิน/ }).click();
  await expect(page.getByLabel('พื้นที่จัดส่ง')).toBeVisible();
  await page.getByLabel('พื้นที่จัดส่ง').selectOption({ label: zone });
  await page.getByLabel('ความเร็วในการจัดส่ง').selectOption({ label: speed });
}

export async function confirmOrderUI(page: Page) {
  await page.getByRole('button', { name: /ยืนยันสั่งซื้อ/ }).click();
}
