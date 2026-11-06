import type { User, Product, Cart, Coupon, Order, PaymentResult, Session } from '../types';

export interface ApiError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

let authRequiredHandler: (() => void) | null = null;

export function setAuthRequiredHandler(handler: (() => void) | null) {
  authRequiredHandler = handler;
}

async function request<T>(path: string, options: RequestOptions, fallbackMessage: string, fallbackCode: string): Promise<T> {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { code, message, ...details } = data;
    const error: ApiError = new Error(message || fallbackMessage);
    error.code = code || fallbackCode;
    error.status = response.status;
    error.details = details;

    if (error.code === 'AUTH_REQUIRED') authRequiredHandler?.();

    throw error;
  }

  return data;
}

export function loginApi(username: string, password: string): Promise<{ accessToken: string; user: User }> {
  return request('/login', { method: 'POST', body: { username, password } }, 'Login failed', 'AUTH_ERROR');
}

// ผู้ใช้ปัจจุบันและ stage (ใช้เลือกหน้าตาม stage, DC-2.13)
export function fetchSessionApi(token: string): Promise<Session> {
  return request('/me', { token }, 'Failed to load session', 'SESSION_ERROR');
}

export function fetchProductsApi(token: string): Promise<{ products: Product[] }> {
  return request('/list', { token }, 'Failed to fetch products', 'PRODUCTS_ERROR');
}

export function fetchCartApi(token: string): Promise<{ cart: Cart }> {
  return request('/cart', { token }, 'Failed to fetch cart', 'CART_ERROR');
}

export function addToCartApi(token: string, productId: string, quantity: number = 1): Promise<{ message: string; cart: Cart }> {
  return request('/cart/items', { method: 'POST', token, body: { productId, quantity } }, 'Failed to add item to cart', 'CART_ERROR');
}

export function updateCartItemApi(token: string, productId: string, quantity: number): Promise<{ message: string; cart: Cart }> {
  return request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'PATCH', token, body: { quantity } }, 'Failed to update cart item', 'CART_ERROR');
}

export function removeCartItemApi(token: string, productId: string): Promise<{ message: string; cart: Cart }> {
  return request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE', token }, 'Failed to remove cart item', 'CART_ERROR');
}

export function applyCouponApi(token: string, code: string): Promise<{ message: string; cart: Cart }> {
  return request('/cart/items', { method: 'PUT', token, body: { code } }, 'Failed to apply coupon', 'CART_ERROR');
}

// ยังไม่มีเลข order ตอน checkout จึงใช้ "new" ใน path (ดู API.md)
export function checkoutApi(token: string, zone: string, speed: string): Promise<{ message: string; order: Order; notice?: string }> {
  return request('/orders/new/payment', { method: 'POST', token, body: { zone, speed } }, 'Failed to create order', 'ORDER_ERROR');
}

export function payOrderApi(token: string, orderId: string, result: PaymentResult): Promise<{ message: string; order: Order }> {
  return request(`/orders/${encodeURIComponent(orderId)}/payment`, { method: 'POST', token, body: { orderId, result } }, 'Failed to process payment', 'ORDER_ERROR');
}

export function cancelOrderApi(token: string, orderId: string): Promise<{ message: string; order: Order }> {
  return request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', token }, 'Failed to cancel order', 'ORDER_ERROR');
}

export function fetchOrdersApi(token: string): Promise<{ orders: Order[] }> {
  return request('/orders', { token }, 'Failed to fetch orders', 'ORDER_ERROR');
}

export function fetchOrderApi(token: string, orderId: string): Promise<{ order: Order }> {
  return request(`/orders/${encodeURIComponent(orderId)}`, { token }, 'Failed to fetch order', 'ORDER_ERROR');
}

// OP-12 continueShopping
export function continueShoppingApi(token: string): Promise<{ cart: Cart }> {
  return request('/cart/continue', { method: 'POST', token }, 'Failed to continue shopping', 'CART_ERROR');
}

// ---------- Admin ----------

// OP-15 updateProduct
export function updateProductApi(token: string, productId: string, changes: { price?: number; stock?: number }): Promise<{ message: string; product: Product }> {
  return request(`/admin/products/${encodeURIComponent(productId)}/update`, { method: 'PATCH', token, body: changes }, 'Failed to update product', 'ADMIN_ERROR');
}

// OP-16 setProductStatus
export function setProductStatusApi(token: string, productId: string, status: string): Promise<{ message: string; product: Product }> {
  return request(`/admin/products/${encodeURIComponent(productId)}/set`, { method: 'PATCH', token, body: { status } }, 'Failed to update product status', 'ADMIN_ERROR');
}

// OP-18 listCoupons
export function fetchCouponsApi(token: string): Promise<{ coupons: Coupon[] }> {
  return request('/admin/coupons', { token }, 'Failed to fetch coupons', 'ADMIN_ERROR');
}

// OP-17 setCouponStatus (API.md: 1 = เปิดใช้, 0 = ปิดใช้)
export function setCouponStatusApi(token: string, code: string, active: boolean): Promise<{ message: string; coupon: Coupon }> {
  return request(`/admin/coupons/${encodeURIComponent(code)}/set`, { method: 'PATCH', token, body: { status: active ? 1 : 0 } }, 'Failed to update coupon status', 'ADMIN_ERROR');
}
