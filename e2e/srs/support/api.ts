import { expect, type APIRequestContext } from '@playwright/test';
import type { ProductId, Speed, Username, Zone } from './seed';

// ใช้เตรียม Given เท่านั้น ขั้น When ของทุก test ทำผ่านหน้าเว็บ
// path และ body ตาม API contract ของกลุ่ม (API.md) ซึ่งเป็นส่วนที่ spec ให้นิสิตออกแบบเอง
// backend ไม่ได้ proxy /admin และ /test ผ่าน vite จึงเรียก backend ตรง
export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// รหัสผ่านของแต่ละบัญชี: TEST_PASSWORD_CUS_NORMAL / TEST_PASSWORD_CUS_PRIME / TEST_PASSWORD_ADMIN01
// ถ้าไม่ได้ตั้งแยก ใช้ TEST_PASSWORD ร่วมกัน
export function passwordFor(username: string): string {
  const value = process.env[`TEST_PASSWORD_${username.toUpperCase()}`] ?? process.env.TEST_PASSWORD;
  if (!value) throw new Error(`ยังไม่ได้ตั้งรหัสผ่านของ ${username} (TEST_PASSWORD ใน .env)`);
  return value;
}

// DC-3.1: คืนข้อมูลทั้งหมดเป็น seed data ของส่วนที่ 7
export async function resetToSeed(request: APIRequestContext) {
  const res = await request.post(`${API_URL}/test/reset`);
  expect(res.status(), `POST /test/reset (DC-3.1) -> ${await res.text()}`).toBe(200);
}

export class ApiActor {
  private constructor(
    private readonly request: APIRequestContext,
    readonly username: Username,
    private readonly token: string
  ) {}

  static async login(request: APIRequestContext, username: Username): Promise<ApiActor> {
    const res = await request.post(`${API_URL}/login`, {
      data: { username, password: passwordFor(username) },
    });
    expect(res.ok(), `Given: login ${username} -> ${res.status()} ${await res.text()}`).toBeTruthy();
    const { accessToken } = await res.json();
    return new ApiActor(request, username, accessToken);
  }

  // ส่งคำสั่งด้วยสิทธิ์ของผู้ใช้คนนี้ แล้วคืนผลโดยไม่ตรวจว่าสำเร็จ
  // ใช้กับ AC ที่หน้าเว็บไม่มีปุ่มให้ทำ (AC-11c, AC-14, AC-17) ซึ่งต้องยืนยันว่า api-server ปฏิเสธเอง
  async attempt(method: string, path: string, data?: unknown): Promise<{ status: number; body: any }> {
    const res = await this.request.fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
      data,
    });
    return { status: res.status(), body: await res.json().catch(() => ({})) };
  }

  private async send(method: string, path: string, data?: unknown) {
    const { status, body } = await this.attempt(method, path, data);
    expect(status >= 200 && status < 300, `Given: ${this.username} ${method} ${path} -> ${status} ${JSON.stringify(body)}`).toBeTruthy();
    return body;
  }

  // ---------- Customer ----------

  addItem(productId: ProductId, quantity: number) {
    return this.send('POST', '/cart/items', { productId, quantity }); // OP-3
  }

  applyCoupon(code: string) {
    return this.send('PUT', '/cart/items', { code }); // OP-6
  }

  async pressCheckout(zone: Zone, speed: Speed): Promise<string> {
    const body = await this.send('POST', '/orders/new/payment', { zone, speed }); // OP-8
    return body.order.id as string;
  }

  cancelCheckout(orderId: string) {
    return this.send('POST', `/orders/${encodeURIComponent(orderId)}/cancel`); // OP-9
  }

  // OP-10: ฝั่ง gateway ใน Given เท่านั้น ถ้าเป็นขั้น When ให้กดปุ่ม gateway-pay-success (DC-3.3)
  paySuccess(orderId: string) {
    return this.send('POST', `/orders/${encodeURIComponent(orderId)}/payment`, { orderId, result: 'success' });
  }

  // ---------- Admin ----------

  setProductStatus(productId: ProductId, status: 'เปิดขาย' | 'ปิดขาย') {
    return this.send('PATCH', `/admin/products/${productId}/set`, { status }); // OP-16
  }

  setCouponStatus(code: string, status: 'เปิดใช้' | 'ปิดใช้') {
    // API.md: 1 = เปิดใช้, 0 = ปิดใช้
    return this.send('PATCH', `/admin/coupons/${encodeURIComponent(code)}/set`, { status: status === 'เปิดใช้' ? 1 : 0 }); // OP-17
  }
}
