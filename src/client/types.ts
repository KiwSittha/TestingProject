export interface User {
  id: string;
  username: string;
  role: 'Customer' | 'Admin';
  memberTier?: string | null;
}

// stage ของ Customer ตามส่วนที่ 2 ของ spec
export type Stage = 'ตะกร้า' | 'ชำระเงิน' | 'สำเร็จ';

// GET /me
export interface Session {
  user: User;
  stage: Stage | null; // null สำหรับ Admin
  orderId: string | null;
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
  weight_gram?: number;
  available_stock?: number;
  status?: string;
}

export interface Coupon {
  code: string;
  percent: number;
  min_spend: number;
  status: string;
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

// ข้อความบนหน้าจอ (DC-2.8): แสดงเป็น element app-message พร้อม data-kind และ data-code
//   error  = การปฏิเสธที่มี error code
//   notice = notice ที่มี code เช่น COUPON_NOT_APPLICABLE
//   info   = ข้อความอื่น เช่นข้อความที่ FR กำหนด (data-code ว่าง)
export type MessageKind = 'error' | 'notice' | 'info';
export type MessageTone = 'success' | 'error' | 'warning' | 'info';

export interface AppMessage {
  id: string;
  kind: MessageKind;
  tone: MessageTone;
  text: string;
  code: string;
}

// หน้าที่ App แสดง เลือกจาก URL บทบาท และ stage
export type PageKey =
  | 'login'
  | 'loading'
  | 'products'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'orders'
  | 'order-detail'
  | 'admin-products'
  | 'admin-coupons';
