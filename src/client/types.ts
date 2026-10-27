export interface User {
  id: string;
  username: string;
  role: 'Customer' | 'Admin';
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
  stock?: number;
}

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  image_url: string;
  category: string;
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  itemsCount: number;
  total: number;
  status: string;
  badgeClass?: string;
  txnId?: string;
  items?: CartItem[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  code?: string | undefined;
}

export type ViewType = 'login' | 'products' | 'cart' | 'checkout' | 'order-confirmation' | 'order-history';
