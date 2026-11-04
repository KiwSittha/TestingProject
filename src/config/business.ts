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
  PAID: "ชำระเงินแล้ว",
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
export const SHIPPING_ZONES = ["inCity", "upcountry", "remote"] as const;
export const SHIPPING_SPEEDS = ["standard", "express"] as const;
export const SHIPPING_BASE_RATES: Record<string, Record<string, number>> = {
  light: { inCity: 30, upcountry: 50, remote: 80 },
  medium: { inCity: 50, upcountry: 80, remote: 120 },
  heavy: { inCity: 80, upcountry: 120, remote: 180 }
};

export function shippingFeeFor(
  totalWeightGram: number,
  zone: string,
  speed: string,
  memberTier: string
): number | undefined {
  if (!SHIPPING_ZONES.includes(zone as (typeof SHIPPING_ZONES)[number]) ||
      !SHIPPING_SPEEDS.includes(speed as (typeof SHIPPING_SPEEDS)[number])) {
    return undefined;
  }

  const weightTier = totalWeightGram <= 1_000
    ? "light"
    : totalWeightGram <= 5_000
      ? "medium"
      : "heavy";
  const base = SHIPPING_BASE_RATES[weightTier]?.[zone];
  if (base === undefined) return undefined;
  if (memberTier === "prime") {
    return speed === "standard" ? 0 : Math.floor(base / 2);
  }
  return speed === "standard" ? base : Math.floor((base * 3) / 2);
}
