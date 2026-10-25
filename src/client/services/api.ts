import type { User, Product } from '../types';

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

export async function loginApi(username: string, password: string): Promise<{ accessToken: string; user: User }> {
  const response = await fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: ApiError = new Error(data.message || 'Login failed');
    error.code = data.code || 'AUTH_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function fetchProductsApi(token: string): Promise<{ products: Product[] }> {
  const response = await fetch('/list', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: ApiError = new Error(data.message || 'Failed to fetch products');
    error.code = data.code || 'PRODUCTS_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
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
      product_id: productId,
      quantity: quantity,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: ApiError = new Error(data.message || 'Failed to add item to cart');
    error.code = data.code || 'CART_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
}
