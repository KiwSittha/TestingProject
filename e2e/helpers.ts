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

const COUPON_CODE = 'SAVE10';

export function password(): string {
  const value = process.env.TEST_PASSWORD;
  if (!value) throw new Error('TEST_PASSWORD is not set (.env or CI secret)');
  return value;
}

// ---------- API: ใช้เตรียม precondition และตรวจผลฝั่ง backend ----------

export type Order = { id: string; status: string; net_total: number };

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

  async clearCart() {
    for (const item of (await this.cart()).items) {
      await this.ok('DELETE', `/cart/items/${item.productId}`);
    }
  }

  async orders(): Promise<Order[]> {
    return (await this.ok('GET', '/orders')).orders;
  }

  async order(orderId: string): Promise<Order> {
    return (await this.ok('GET', `/orders/${encodeURIComponent(orderId)}`)).order;
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

// เทสเขียนลง database จริง จึงตั้งข้อมูลกลับเป็นค่าตั้งต้นก่อนทุกเทส:
// สินค้าและคูปองกลับเป็นค่าเดิม ไม่มี order ค้างชำระ และตะกร้าของ cus_normal ว่าง
export async function resetTestData(request: APIRequestContext) {
  const admin = await ShopApi.login(request, ADMIN);
  for (const [id, product] of Object.entries(PRODUCTS)) {
    await admin.call('PATCH', `/admin/products/${id}/update`, { price: product.price, stock: product.stock });
    await admin.setProductStatus(id as ProductId, 'เปิดขาย');
  }
  await admin.call('PATCH', `/admin/coupons/${COUPON_CODE}/set`, { status: 1 });

  const customer = await ShopApi.login(request, CUSTOMER);
  await customer.cancelPendingOrders();
  await customer.clearCart();
  expect((await customer.cart()).items).toHaveLength(0);
  expect((await customer.orders()).filter(o => o.status === 'รอชำระเงิน')).toHaveLength(0);
  return customer;
}

// ---------- UI ----------

export async function fillLogin(page: Page, username: string, pass: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ EatSomeWhere' })).toBeVisible();
  await page.getByLabel('ชื่อผู้ใช้').fill(username);
  await page.getByLabel('รหัสผ่าน').fill(pass);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}

export async function loginUI(page: Page) {
  await fillLogin(page, CUSTOMER, password());
  await expect(page.getByText('พบ 3 รายการ')).toBeVisible();
  await expect(cartButton(page, 0)).toBeVisible();
}

export function cartButton(page: Page, count: number): Locator {
  return page.getByRole('button', { name: `ตะกร้าสินค้า ${count}`, exact: true });
}

function productCard(page: Page, productId: ProductId): Locator {
  return page
    .getByRole('heading', { name: PRODUCTS[productId].name, exact: true })
    .locator('xpath=ancestor::div[.//button][1]');
}

// กด "เพิ่มลงตะกร้า" แล้วรอ toast และตัวเลขตะกร้าบนหัวเว็บเป็น expectedCount
export async function addToCartUI(page: Page, productId: ProductId, expectedCount: number) {
  await productCard(page, productId).getByRole('button', { name: 'เพิ่มลงตะกร้า' }).click();
  await expect(page.getByText(`เพิ่ม "${PRODUCTS[productId].name}" ลงตะกร้าเรียบร้อยแล้ว!`).first()).toBeVisible();
  await expect(cartButton(page, expectedCount)).toBeVisible();
}

export function cartRow(page: Page, productId: ProductId): Locator {
  return page
    .getByRole('heading', { name: PRODUCTS[productId].name, exact: true })
    .locator('xpath=ancestor::div[.//button[@title="ลบรายการ"]][1]');
}

// เปิดตะกร้าจากหัวเว็บ แล้วกด "ดำเนินการชำระเงิน" ไปหน้าเลือกการจัดส่ง (ยังไม่สร้าง order)
export async function goToCheckoutUI(page: Page, count: number) {
  await cartButton(page, count).click();
  await expect(page.getByRole('heading', { name: 'ตะกร้าสินค้าสำหรับองค์กร' })).toBeVisible();
  await page.getByRole('button', { name: 'ดำเนินการชำระเงิน' }).click();
  await expect(page.getByRole('heading', { name: 'ตรวจสอบคำสั่งซื้อและการชำระเงิน' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'เลือกการจัดส่งเพื่อสร้างคำสั่งซื้อ' })).toBeVisible();
}

export type Zone = 'ในเมือง' | 'ต่างจังหวัด';
export type Speed = 'ส่งแบบปกติ' | 'ส่งด่วน';

// เลือกพื้นที่และความเร็วในการจัดส่ง แล้วกด "สร้างคำสั่งซื้อ" (OP-8 pressCheckout) คืนเลข order ที่หน้าเว็บแสดง
export async function createOrderUI(page: Page, zone: Zone, speed: Speed): Promise<string> {
  await page.getByRole('radio', { name: zone }).check();
  await page.getByRole('radio', { name: speed, exact: true }).check();
  await page.getByRole('button', { name: 'สร้างคำสั่งซื้อ' }).click();

  const heading = page.getByRole('heading', { name: /^คำสั่งซื้อ #/ });
  await expect(heading).toBeVisible();
  await expect(page.getByText('สร้างคำสั่งซื้อแล้ว กรุณายืนยันการชำระเงินหรือยกเลิกคำสั่งซื้อ')).toBeVisible();
  return (await heading.textContent())!.replace('คำสั่งซื้อ #', '').trim();
}
