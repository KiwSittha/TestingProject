// ค่าทุกตัวในไฟล์นี้คัดมาจาก SRS-CART-002 v1.8 โดยตรง ห้ามแก้ตามพฤติกรรมของโปรแกรม (ส่วนที่ 1.1)

// ส่วนที่ 7: บัญชี
export const ACCOUNTS = {
  normal: 'cus_normal', // Customer, memberTier = normal
  prime: 'cus_prime', // Customer, memberTier = prime
  admin: 'admin01', // Admin
} as const;
export type Username = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

// ส่วนที่ 7: สินค้า
export const SEED_PRODUCTS = {
  P1: { name: 'Coffee Beans 250g', price: 450, weightGram: 300, stock: 20 },
  P2: { name: 'Drip Kettle', price: 1200, weightGram: 900, stock: 3 },
  P3: { name: 'Espresso Machine', price: 15000, weightGram: 8000, stock: 5 },
} as const;
export type ProductId = keyof typeof SEED_PRODUCTS;
export const PRODUCT_IDS = Object.keys(SEED_PRODUCTS) as ProductId[];

// ส่วนที่ 7: คูปอง
export const SEED_COUPON = { code: 'SAVE10', percent: 10, minSpend: 1000 } as const;

// ส่วนที่ 2: ค่า enum ของสถานะ (DC-2.9 ใช้เป็นค่า data-status)
export const STATUS = {
  product: { onSale: 'เปิดขาย', offSale: 'ปิดขาย' },
  coupon: { active: 'เปิดใช้', inactive: 'ปิดใช้' },
  order: { pending: 'รอชำระเงิน', paid: 'ชำระเงินแล้ว', cancelled: 'ยกเลิก' },
} as const;

// ส่วนที่ 2: zone / speed
export type Zone = 'inCity' | 'upcountry' | 'remote';
export type Speed = 'standard' | 'express';

// ข้อความที่ FR กำหนด
export const MESSAGES = {
  cartEmpty: 'ตะกร้าว่าง', // FR-2.7.4
  payFail: 'การชำระเงินล้มเหลว กรุณาลองใหม่', // FR-6.2.1
  couponNotApplicable: 'คูปองไม่สามารถใช้กับคำสั่งซื้อนี้', // FR-4.3.2
} as const;

// ส่วนที่ 5 และ notice ของ FR-4.3.2
export const CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  QTY_OUT_OF_RANGE: 'QTY_OUT_OF_RANGE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  COUPON_INVALID: 'COUPON_INVALID',
  ITEMS_UNAVAILABLE: 'ITEMS_UNAVAILABLE',
  WEIGHT_LIMIT_EXCEEDED: 'WEIGHT_LIMIT_EXCEEDED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  COUPON_NOT_APPLICABLE: 'COUPON_NOT_APPLICABLE',
} as const;

// ตาราง 6.2.2
export const URLS = {
  login: '/login',
  products: '/products',
  cart: '/cart',
  checkout: '/checkout',
  success: '/success',
  orders: '/orders',
  orderDetail: (orderId: string) => `/orders/${encodeURIComponent(orderId)}`,
  adminProducts: '/admin/products',
  adminCoupons: '/admin/coupons',
} as const;

// ยอดเงินที่หน้าจอต้องแสดง (FR-4.8: total = subtotal − discount + shipping)
export type Amounts = { subtotal: number; discount: number; shipping: number; total: number };
