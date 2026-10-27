// ค่าคงที่และกฎทางธุรกิจทั้งหมดรวมไว้ที่นี่ แก้ให้ตรงกับ SRS ได้จุดเดียว

export const ROLES = {
  CUSTOMER: "Customer",
  ADMIN: "Admin"
} as const;

export const PRODUCT_STATUS = {
  ON_SALE: "เปิดขาย",
  OFF_SALE: "ปิดขาย"
} as const;

export const COUPON_STATUS = {
  ACTIVE: "เปิดใช้",
  INACTIVE: "ปิดใช้"
} as const;

export const ORDER_STATUS = {
  PENDING_PAYMENT: "รอชำระเงิน",
  PAID: "ชำระเงินสำเร็จ",
  PAYMENT_FAILED: "ชำระเงินไม่สำเร็จ",
  CANCELLED: "ยกเลิก"
} as const;

// users.current_stage
export const USER_STAGE = {
  CART: "ตะกร้า",
  PAYMENT: "ชำระเงิน",
  COMPLETED: "สำเร็จ"
} as const;

// จำนวนต่อสินค้า 1 รายการในตะกร้า (QTY_OUT_OF_RANGE)
export const QTY_MIN = 1;
export const QTY_MAX = 10;

// น้ำหนักรวมของตะกร้า (WEIGHT_LIMIT_EXCEEDED)
export const MAX_CART_WEIGHT_GRAM = 20000;

// ค่าส่งตาม zone และ speed (บาท)
export const SHIPPING_FEE: Record<string, Record<string, number>> = {
  bangkok: { standard: 40, express: 80 },
  upcountry: { standard: 60, express: 120 }
};
