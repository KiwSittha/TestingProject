import type { User, Product, Cart, Order, PaymentResult } from '../types';

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

export function fetchProductsApi(token: string): Promise<{ products: Product[] }> {
  return request('/list', { token }, 'Failed to fetch products', 'PRODUCTS_ERROR');
}

export function fetchCartApi(token: string): Promise<{ cart: Cart }> {
  return request('/cart', { token }, 'Failed to fetch cart', 'CART_ERROR');
}

export function addToCartApi(token: string, productId: string, quantity: number = 1): Promise<{ message: string; cart: Cart }> {
  return request('/cart/items', { method: 'POST', token, body: { productId, quantity } }, 'Failed to add item to cart', 'CART_ERROR');
}

export async function addToCartApi(token: string, cartId: string, productId: string | number, quantity: number = 1): Promise<{ message: string; cartItem: any }> {
  const response = await fetch('/cart/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      cart_id: cartId,
      productId: String(productId),
      quantity: quantity,
    }),
  });

export function removeCartItemApi(token: string, productId: string): Promise<{ message: string; cart: Cart }> {
  return request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE', token }, 'Failed to remove cart item', 'CART_ERROR');
}

export function applyCouponApi(token: string, code: string): Promise<{ message: string; cart: Cart }> {
  return request('/cart/items', { method: 'PUT', token, body: { code } }, 'Failed to apply coupon', 'CART_ERROR');
}

// ยังไม่มีเลข order ตอน checkout จึงใช้ "new" ใน path (ดู API.md)
export function checkoutApi(token: string, zone: string, speed: string): Promise<{ message: string; order: Order }> {
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
