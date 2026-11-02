export interface User {
  id: string;
  username: string;
  role: 'Customer' | 'Admin';
  memberTier?: string | null;
}

export interface Product {
  id: string | number;
  name?: string;
  title?: string;
  price: number | string;
  description?: string;
  image_url?: string;
  image?: string;
  category?: string;
  available_stock?: number;
  status?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  weightGram: number;
  quantity: number;
  lineTotal: number;
  status: string;
  availableStock: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  totalQuantity: number;
  totalWeightGram: number;
  subtotal: number;
  coupon: { code: string; percent: number; minSpend: number } | null;
  discount: number;
  total: number;
  notice?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  net_total: number;
  zone: string;
  speed: string;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export type PaymentResult = 'success' | 'fail';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  code?: string | undefined;
}

export type ViewType = 'login' | 'products' | 'cart' | 'checkout' | 'order-confirmation' | 'order-history';
