import { expect, type Locator, type Page } from '@playwright/test';
import { passwordFor } from './api';
import {
  ACCOUNTS,
  PRODUCT_IDS,
  SEED_COUPON,
  URLS,
  type Amounts,
  type ProductId,
  type Speed,
  type Username,
  type Zone,
} from './seed';

// หา element ด้วย data-testid ตามตาราง 6.2.1 (DC-2.4) และตรวจค่าจาก attribute (DC-2.7–2.11)
// ไม่ตรวจจากข้อความที่จัดรูปแบบแล้ว เช่น "฿1,485.00"

// ---------- การกดปุ่มที่เปลี่ยนข้อมูล ----------

// กดปุ่มแล้วรอจนได้ response ของ request ที่ไม่ใช่ GET (การกระทำที่ส่งไป api-server)
// ใช้ก่อน page.goto หรือก่อนปิด context เพื่อไม่ให้ request ถูกยกเลิกกลางทาง
export async function act(page: Page, target: Locator) {
  const responded = page.waitForResponse(
    (r) => ['fetch', 'xhr'].includes(r.request().resourceType()) && r.request().method() !== 'GET',
    { timeout: 10_000 }
  );
  await target.click();
  await responded;
}

// ---------- หน้า ----------

export async function expectOnPage(page: Page, pageTestId: string) {
  await expect(page.getByTestId(pageTestId), `ต้องแสดง ${pageTestId}`).toBeVisible();
}

// ---------- login (FR-0.1) ----------

export async function submitLogin(page: Page, username: string, password: string) {
  await page.goto(URLS.login);
  await expectOnPage(page, 'page-login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await act(page, page.getByTestId('login-submit'));
}

// login สำเร็จแล้วรอเมนูของบทบาทนั้น (ตาราง 6.2.1 แถว "ทุกหน้าหลัง login")
// spec ไม่ได้กำหนดว่าหลัง login ไปหน้าใด (SOI-3) จึงไม่ตรวจหน้าแรก
export async function login(page: Page, username: Username) {
  await submitLogin(page, username, passwordFor(username));
  const nav = username === ACCOUNTS.admin ? 'nav-admin-products' : 'nav-cart';
  await expect(page.getByTestId(nav), `login ${username} แล้วต้องเห็น ${nav}`).toBeVisible();
}

// ---------- app-message (DC-2.8) ----------

type MessageKind = 'error' | 'notice' | 'info';

export function messages(page: Page, kind: MessageKind, code?: string): Locator {
  const codeSelector = code ? `[data-code="${code}"]` : '';
  return page.locator(`[data-testid="app-message"][data-kind="${kind}"]${codeSelector}`);
}

export async function expectMessage(page: Page, kind: 'error' | 'notice', code: string, text?: string) {
  let message = messages(page, kind, code);
  if (text) message = message.filter({ hasText: text });
  await expect(message.first(), `app-message data-kind="${kind}" data-code="${code}"`).toBeVisible();
}

// data-kind="info" ต้องเว้น data-code ว่าง (DC-2.8)
export async function expectInfoMessage(page: Page, text: string) {
  const message = messages(page, 'info').filter({ hasText: text }).first();
  await expect(message, `app-message data-kind="info" "${text}"`).toBeVisible();
  expect(await message.getAttribute('data-code'), 'data-code ของ info ต้องว่าง').toBeFalsy();
}

// ---------- ค่าใน attribute ----------

export async function expectValue(target: Locator, value: number) {
  await expect(target).toHaveAttribute('data-value', String(value));
}

export async function expectStatus(target: Locator, status: string) {
  await expect(target).toHaveAttribute('data-status', status);
}

// prefix = checkout | success | order-detail
export async function expectAmounts(page: Page, prefix: 'checkout' | 'success' | 'order-detail', amounts: Amounts) {
  await expectValue(page.getByTestId(`${prefix}-subtotal`), amounts.subtotal);
  await expectValue(page.getByTestId(`${prefix}-discount`), amounts.discount);
  await expectValue(page.getByTestId(`${prefix}-shipping`), amounts.shipping);
  await expectValue(page.getByTestId(`${prefix}-total`), amounts.total);
}

// spec ไม่ได้ให้ data-value กับ orderId (SOI-5) จึงอ่านจากข้อความ โดยตัด "#" นำหน้าออก
export async function readOrderId(target: Locator): Promise<string> {
  await expect(target).toHaveText(/\S/);
  return (await target.textContent())!.trim().replace(/^#\s*/, '');
}

export async function expectOrderId(target: Locator, orderId: string) {
  await expect(target).toHaveText(new RegExp(`^\\s*#?\\s*${escapeRegExp(orderId)}\\s*$`));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- page-products (FR-1.3.1, OP-3) ----------

export const productRow = (page: Page, productId: ProductId) => page.getByTestId(`product-row-${productId}`);

export async function addItemUI(page: Page, productId: ProductId, quantity: number) {
  await page.goto(URLS.products);
  await expectOnPage(page, 'page-products');
  const row = productRow(page, productId);
  await row.getByTestId('product-add-qty').fill(String(quantity));
  await act(page, row.getByTestId('product-add-button'));
}

// ---------- page-cart (FR-2, FR-3, FR-5) ----------

export const cartLine = (page: Page, productId: ProductId) => page.getByTestId(`cart-line-${productId}`);

export async function openCart(page: Page) {
  await page.goto(URLS.cart);
  await expectOnPage(page, 'page-cart');
}

export async function expectCartLine(
  page: Page,
  productId: ProductId,
  line: { unitPrice: number; qty: number; available: boolean }
) {
  const row = cartLine(page, productId);
  await expect(row).toHaveCount(1); // DC-2.5 + นิยาม cart line: สินค้าหนึ่งชนิดมีได้ไม่เกินหนึ่งรายการ
  await expectValue(row.getByTestId('cart-line-unit-price'), line.unitPrice);
  await expectValue(row.getByTestId('cart-line-qty'), line.qty);
  await expect(row.getByTestId('cart-line-availability')).toHaveAttribute('data-available', String(line.available));
}

// ตะกร้าว่าง: ยอดรวมสินค้า = 0 และไม่มีแถวใด (ตรวจยอดก่อน เพื่อให้รู้ว่าหน้าโหลดเสร็จแล้ว)
export async function expectCartEmpty(page: Page) {
  await expectValue(page.getByTestId('cart-subtotal'), 0);
  for (const id of PRODUCT_IDS) await expect(cartLine(page, id)).toHaveCount(0);
}

export async function expectCouponBound(page: Page, code: string = SEED_COUPON.code) {
  await expect(page.getByTestId('cart-coupon-code')).toHaveText(new RegExp(`\\b${code}\\b`));
}

// ไม่มีคูปองผูก: ไม่มี cart-coupon-code ที่แสดง code ของคูปองใน seed (มีคูปองเดียวในระบบ)
// ต้องเรียกหลังตรวจค่าอื่นในหน้าตะกร้าแล้ว ไม่อย่างนั้นจะผ่านก่อนหน้าโหลดเสร็จ
export async function expectNoCouponBound(page: Page) {
  await expect(page.getByTestId('cart-coupon-code').filter({ hasText: SEED_COUPON.code })).toHaveCount(0);
}

export async function applyCouponUI(page: Page, code: string) {
  await page.getByTestId('coupon-input').fill(code);
  await act(page, page.getByTestId('coupon-apply'));
}

export async function updateQuantityUI(page: Page, productId: ProductId, quantity: number) {
  const row = cartLine(page, productId);
  await row.getByTestId('cart-line-qty-input').fill(String(quantity));
  await act(page, row.getByTestId('cart-line-update'));
}

export async function removeItemUI(page: Page, productId: ProductId) {
  await act(page, cartLine(page, productId).getByTestId('cart-line-remove'));
}

// OP-8 จากหน้าตะกร้า (zone-select, speed-select, checkout-button อยู่ใน page-cart ตามตาราง 6.2.1)
export async function pressCheckoutUI(page: Page, zone: Zone, speed: Speed) {
  await page.getByTestId('zone-select').selectOption(zone);
  await page.getByTestId('speed-select').selectOption(speed);
  await act(page, page.getByTestId('checkout-button'));
}

// pressCheckout ที่ต้องสำเร็จ: ต้องไปหน้า page-checkout และคืน orderId ที่หน้าจอแสดง
export async function checkoutToPaymentUI(page: Page, zone: Zone, speed: Speed): Promise<string> {
  await pressCheckoutUI(page, zone, speed);
  await expectOnPage(page, 'page-checkout');
  return readOrderId(page.getByTestId('checkout-order-id'));
}

// ---------- page-checkout (FR-6, FR-7, DC-3.3) ----------

export async function paySuccessUI(page: Page) {
  await act(page, page.getByTestId('gateway-pay-success'));
}

export async function payFailUI(page: Page) {
  await act(page, page.getByTestId('gateway-pay-fail'));
}

export async function cancelCheckoutUI(page: Page) {
  await act(page, page.getByTestId('cancel-checkout-button'));
}

// ---------- page-orders (FR-0.5, FR-0.6) ----------

export const orderRow = (page: Page, orderId: string) => page.getByTestId(`order-row-${orderId}`);

// แถวออเดอร์ทั้งหมดตามลำดับที่แสดงบนหน้าจอ
export const allOrderRows = (page: Page) => page.locator('[data-testid^="order-row-"]');

// ---------- page-admin-* (FR-9, FR-10) ----------

export const adminProductRow = (page: Page, productId: ProductId) => page.getByTestId(`admin-product-row-${productId}`);
export const adminCouponRow = (page: Page, code: string) => page.getByTestId(`admin-coupon-row-${code}`);
