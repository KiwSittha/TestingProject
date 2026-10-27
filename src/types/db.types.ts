// โครงสร้างตารางใน Supabase

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  member_tier: string | null;
  status: string;
  current_stage: string | null;
  current_order_id: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  price: number;
  weight_gram: number;
  available_stock: number;
  status: string;
  updated_at: string;
}

export interface CouponRow {
  code: string;
  percent: number;
  min_spend: number;
  status: string;
}

export interface CartRow {
  id: string;
  user_id: string;
  applied_coupon_code: string | null;
  updated_at: string;
}

export interface CartItemRow {
  cart_id: string;
  product_id: string;
  quantity: number;
}

export interface OrderRow {
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
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}
