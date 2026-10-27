import { supabase } from "../config/supabase";
import {
  COUPON_STATUS,
  MAX_CART_WEIGHT_GRAM,
  PRODUCT_STATUS,
  QTY_MAX,
  QTY_MIN
} from "../config/business";
import { ApiError, dbCheck } from "../utils/errors";
import type {
  CartItemRow,
  CartRow,
  CouponRow,
  ProductRow
} from "../types/db.types";

export const COUPON_NOT_APPLICABLE_MESSAGE =
  "คูปองไม่สามารถใช้กับคำสั่งซื้อนี้";

export interface CartLine {
  product: ProductRow;
  quantity: number;
}

export interface CartSummary {
  cartId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    weightGram: number;
    quantity: number;
    lineTotal: number;
    status: string;
    availableStock: number;
  }>;
  totalQuantity: number;
  totalWeightGram: number;
  subtotal: number;
  coupon: { code: string; percent: number; minSpend: number } | null;
  discount: number;
  total: number;
  notice?: string;
}

export async function getOrCreateCart(userId: string): Promise<CartRow> {
  const existing = dbCheck(
    await supabase
      .from("carts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<CartRow>(),
    "Load cart"
  );

  if (existing) {
    return existing;
  }

  return dbCheck(
    await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("*")
      .single<CartRow>(),
    "Create cart"
  );
}

export async function getCartLines(cartId: string): Promise<CartLine[]> {
  const items = dbCheck(
    await supabase
      .from("cart_items")
      .select("product_id, quantity, products(*)")
      .eq("cart_id", cartId)
      .order("product_id")
      .returns<Array<Omit<CartItemRow, "cart_id"> & { products: ProductRow }>>(),
    "Load cart items"
  );

  return items.map((item) => ({
    product: item.products,
    quantity: item.quantity
  }));
}

export async function getProduct(productId: string): Promise<ProductRow> {
  const product = dbCheck(
    await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle<ProductRow>(),
    "Load product"
  );

  if (!product) {
    throw new ApiError("PRODUCT_NOT_FOUND", `Product '${productId}' not found`);
  }

  return product;
}

export function subtotalOf(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
}

export function weightOf(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.product.weight_gram * l.quantity, 0);
}

export function discountOf(subtotal: number, coupon: CouponRow | null): number {
  return coupon ? Math.floor((subtotal * coupon.percent) / 100) : 0;
}

// ตรวจว่าสินค้า 1 รายการ ใส่ตะกร้าด้วยจำนวนนี้ได้ไหม
export function assertLineAllowed(product: ProductRow, quantity: number) {
  if (product.status !== PRODUCT_STATUS.ON_SALE) {
    throw new ApiError(
      "PRODUCT_UNAVAILABLE",
      `Product '${product.id}' is not available for sale`
    );
  }

  if (quantity < QTY_MIN || quantity > QTY_MAX) {
    throw new ApiError(
      "QTY_OUT_OF_RANGE",
      `Quantity must be between ${QTY_MIN} and ${QTY_MAX}`,
      { productId: product.id, quantity }
    );
  }

  if (quantity > product.available_stock) {
    throw new ApiError(
      "INSUFFICIENT_STOCK",
      `Only ${product.available_stock} item(s) of '${product.id}' left in stock`,
      { productId: product.id, availableStock: product.available_stock }
    );
  }
}

export function assertWeightAllowed(lines: CartLine[]) {
  const totalWeightGram = weightOf(lines);

  if (totalWeightGram > MAX_CART_WEIGHT_GRAM) {
    throw new ApiError(
      "WEIGHT_LIMIT_EXCEEDED",
      `Total weight must not exceed ${MAX_CART_WEIGHT_GRAM} grams`,
      { totalWeightGram, maxWeightGram: MAX_CART_WEIGHT_GRAM }
    );
  }
}

// แทนจำนวนของสินค้าตัวหนึ่งในรายการ (ใช้คำนวณน้ำหนักก่อนบันทึกจริง)
export function withQuantity(
  lines: CartLine[],
  product: ProductRow,
  quantity: number
): CartLine[] {
  const others = lines.filter((l) => l.product.id !== product.id);
  return quantity > 0 ? [...others, { product, quantity }] : others;
}

export async function findCoupon(code: string): Promise<CouponRow | null> {
  return dbCheck(
    await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .maybeSingle<CouponRow>(),
    "Load coupon"
  );
}

export function isCouponApplicable(coupon: CouponRow, subtotal: number) {
  return coupon.status === COUPON_STATUS.ACTIVE && subtotal >= coupon.min_spend;
}

export async function setCartCoupon(cartId: string, code: string | null) {
  dbCheck(
    await supabase
      .from("carts")
      .update({
        applied_coupon_code: code,
        updated_at: new Date().toISOString()
      })
      .eq("id", cartId),
    "Update cart coupon"
  );
}

// คืนคูปองที่ยังใช้ได้ ถ้าใช้ไม่ได้แล้ว (FR-4.3.1) จะถอดออกจากตะกร้า
export async function resolveCartCoupon(
  cart: CartRow,
  subtotal: number
): Promise<{ coupon: CouponRow | null; removed: boolean }> {
  if (!cart.applied_coupon_code) {
    return { coupon: null, removed: false };
  }

  const coupon = await findCoupon(cart.applied_coupon_code);

  if (coupon && isCouponApplicable(coupon, subtotal)) {
    return { coupon, removed: false };
  }

  await setCartCoupon(cart.id, null);
  cart.applied_coupon_code = null;
  return { coupon: null, removed: true };
}

export async function buildCartSummary(cart: CartRow): Promise<CartSummary> {
  const lines = await getCartLines(cart.id);
  const subtotal = subtotalOf(lines);
  const { coupon, removed } = await resolveCartCoupon(cart, subtotal);
  const discount = discountOf(subtotal, coupon);

  const summary: CartSummary = {
    cartId: cart.id,
    items: lines.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      weightGram: product.weight_gram,
      quantity,
      lineTotal: product.price * quantity,
      status: product.status,
      availableStock: product.available_stock
    })),
    totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0),
    totalWeightGram: weightOf(lines),
    subtotal,
    coupon: coupon
      ? { code: coupon.code, percent: coupon.percent, minSpend: coupon.min_spend }
      : null,
    discount,
    total: subtotal - discount
  };

  if (removed) {
    summary.notice = COUPON_NOT_APPLICABLE_MESSAGE;
  }

  return summary;
}
