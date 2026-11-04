import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { ORDER_STATUS, PRODUCT_STATUS, USER_STAGE, shippingFeeFor } from "../config/business";
import { currentUser } from "../middleware/auth.middleware";
import {
  COUPON_NOT_APPLICABLE_MESSAGE,
  assertWeightAllowed,
  discountOf,
  getCartLines,
  getOrCreateCart,
  resolveCartCoupon,
  setCartCoupon,
  subtotalOf,
  weightOf
} from "../services/cart.service";
import { ApiError, dbCheck } from "../utils/errors";
import {
  assertMatchesPath,
  getBody,
  getParam,
  optionalString,
  requireString
} from "../utils/validate";
import type { CartRow, OrderItemRow, OrderRow, ProductRow } from "../types/db.types";

async function loadOwnOrder(userId: string, orderId: string): Promise<OrderRow> {
  const order = dbCheck(
    await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle<OrderRow>(),
    "Load order"
  );

  // ไม่มีจริง หรือมีแต่ไม่ใช่ของผู้เรียก -> ตอบเหมือนกัน
  if (!order) {
    throw new ApiError("ORDER_NOT_FOUND", `Order '${orderId}' not found`);
  }

  return order;
}

async function loadOrderItems(orderId: string): Promise<OrderItemRow[]> {
  return dbCheck(
    await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("product_id")
      .returns<OrderItemRow[]>(),
    "Load order items"
  );
}

function assertPendingPayment(order: OrderRow) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw new ApiError(
      "OPERATION_NOT_ALLOWED",
      `Order '${order.id}' is not awaiting payment (status: ${order.status})`
    );
  }
}

async function updateOrderStatus(orderId: string, status: string): Promise<OrderRow> {
  return dbCheck(
    await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select("*")
      .single<OrderRow>(),
    "Update order status"
  );
}

async function setUserStage(userId: string, stage: string, orderId: string | null) {
  dbCheck(
    await supabase
      .from("users")
      .update({ current_stage: stage, current_order_id: orderId })
      .eq("id", userId),
    "Update user stage"
  );
}

function assertCheckoutLinesAvailable(
  lines: Array<{ product: ProductRow; quantity: number }>
) {
  const productIds = lines
    .filter(({ product, quantity }) =>
      product.status !== PRODUCT_STATUS.ON_SALE || quantity > product.available_stock
    )
    .map(({ product }) => product.id);

  if (productIds.length > 0) {
    throw new ApiError(
      "ITEMS_UNAVAILABLE",
      "มีสินค้าที่ไม่พร้อมขายหรือมีจำนวนเกินสต็อก",
      { productIds }
    );
  }
}

async function restoreOrderToCart(
  userId: string,
  cart: CartRow,
  items: OrderItemRow[],
  couponCode: string | null
) {
  const cartRows = items.map((item) => ({
    cart_id: cart.id,
    product_id: item.product_id,
    quantity: item.quantity
  }));

  if (cartRows.length > 0) {
    dbCheck(
      await supabase
        .from("cart_items")
        .upsert(cartRows, { onConflict: "cart_id,product_id" }),
      "Restore cancelled order items to cart"
    );
  }
  await setCartCoupon(cart.id, couponCode);
  await setUserStage(userId, USER_STAGE.CART, null);
}

function newOrderId(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${random}`;
}

// OP-8 pressCheckout: POST /orders/:id/payment  body { zone, speed }
// สร้างคำสั่งซื้อจากตะกร้า (:id ใน path ยังไม่มี ใช้ค่าอะไรก็ได้ เช่น "new")
export async function checkout(req: Request, res: Response) {
  const user = currentUser(req);
  const body = getBody(req);
  const zone = requireString(body, "zone");
  const speed = requireString(body, "speed");
  if (shippingFeeFor(1, zone, speed, "normal") === undefined) {
    throw new ApiError("VALIDATION_ERROR", "Invalid zone or speed", {
      allowed: { zones: ["inCity", "upcountry", "remote"], speeds: ["standard", "express"] }
    });
  }

  const cart = await getOrCreateCart(user.userId);
  const lines = await getCartLines(cart.id);

  if (lines.length === 0) {
    throw new ApiError("CART_EMPTY", "ไม่สามารถชำระเงินได้ ตะกร้าว่าง");
  }

  assertCheckoutLinesAvailable(lines);
  assertWeightAllowed(lines);

  const userProfile = dbCheck(
    await supabase
      .from("users")
      .select("member_tier")
      .eq("id", user.userId)
      .maybeSingle<{ member_tier: string | null }>(),
    "Load customer membership tier"
  );
  const memberTier = userProfile?.member_tier ?? "normal";
  const shippingFee = shippingFeeFor(weightOf(lines), zone, speed, memberTier);
  if (shippingFee === undefined) {
    throw new ApiError("VALIDATION_ERROR", "Invalid zone or speed", {
      allowed: { zones: ["inCity", "upcountry", "remote"], speeds: ["standard", "express"] }
    });
  }

  const subtotal = subtotalOf(lines);
  const { coupon, removed } = await resolveCartCoupon(cart, subtotal);

  const discount = coupon
    ? discountOf(subtotal, coupon)
    : memberTier === "prime"
      ? Math.floor((subtotal * 5) / 100)
      : 0;

  const order = dbCheck(
    await supabase
      .from("orders")
      .insert({
        id: newOrderId(),
        user_id: user.userId,
        status: ORDER_STATUS.PENDING_PAYMENT,
        subtotal,
        discount,
        shipping_fee: shippingFee,
        net_total: subtotal - discount + shippingFee,
        zone,
        speed,
        coupon_code: coupon?.code ?? null
      })
      .select("*")
      .single<OrderRow>(),
    "Create order"
  );

  const items = dbCheck(
    await supabase
      .from("order_items")
      .insert(
        lines.map(({ product, quantity }) => ({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          quantity
        }))
      )
      .select("*")
      .returns<OrderItemRow[]>(),
    "Create order items"
  );

  // Reserve available stock on checkout; the reservation stays until pay success
  // or cancellation, per FR-5.3.7 and FR-5.3.10.
  for (const { product, quantity } of lines) {
    dbCheck(
      await supabase
        .from("products")
        .update({
          available_stock: product.available_stock - quantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", product.id),
      "Reserve product stock"
    );
  }

  await setUserStage(user.userId, USER_STAGE.PAYMENT, order.id);

  res.status(200).json({
    message: "Order created, awaiting payment",
    order: { ...order, items },
    ...(removed ? { notice: COUPON_NOT_APPLICABLE_MESSAGE } : {})
  });
}

// OP-10 paySuccess / OP-11 payFail: POST /orders/:id/payment
// body { orderId, result: "success" | "fail" }
export async function pay(req: Request, res: Response) {
  const user = currentUser(req);
  const orderId = getParam(req, "id");
  const body = getBody(req);
  assertMatchesPath(optionalString(body, "orderId"), orderId, "orderId");
  const result = requireString(body, "result");

  if (result !== "success" && result !== "fail") {
    throw new ApiError("VALIDATION_ERROR", "'result' must be 'success' or 'fail'");
  }

  const order = await loadOwnOrder(user.userId, orderId);
  assertPendingPayment(order);

  if (result === "fail") {
    res.status(200).json({
      message: "การชำระเงินล้มเหลว กรุณาลองใหม่",
      order
    });
    return;
  }

  const items = await loadOrderItems(order.id);

  const paid = await updateOrderStatus(order.id, ORDER_STATUS.PAID);

  const cart = await getOrCreateCart(user.userId);
  dbCheck(
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id),
    "Clear purchased cart items"
  );
  await setCartCoupon(cart.id, null);
  await setUserStage(user.userId, USER_STAGE.COMPLETED, order.id);

  res.status(200).json({
    message: "ชำระเงินสำเร็จ",
    order: { ...paid, items }
  });
}

// POST /orders/:id/payment ใช้ร่วมกันระหว่าง OP-8, OP-10, OP-11
export async function orderPayment(req: Request, res: Response) {
  if (getBody(req).result !== undefined) {
    return pay(req, res);
  }
  return checkout(req, res);
}

// OP-9 cancelCheckout: POST /orders/:id/cancel
export async function cancelOrder(req: Request, res: Response) {
  const user = currentUser(req);
  const order = await loadOwnOrder(user.userId, getParam(req, "id"));
  assertPendingPayment(order);

  const items = await loadOrderItems(order.id);
  const products = dbCheck(
    await supabase
      .from("products")
      .select("*")
      .in("id", items.map((item) => item.product_id))
      .returns<ProductRow[]>(),
    "Load products for stock restoration"
  );
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product) continue;
    dbCheck(
      await supabase
        .from("products")
        .update({
          available_stock: product.available_stock + item.quantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.product_id),
      "Restore reserved product stock"
    );
  }

  const cancelled = await updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
  const cart = await getOrCreateCart(user.userId);
  await restoreOrderToCart(user.userId, cart, items, order.coupon_code);

  res.status(200).json({
    message: "Checkout cancelled",
    order: cancelled
  });
}

// OP-13 listOrders: GET /orders
export async function listOrders(req: Request, res: Response) {
  const user = currentUser(req);
  const orders = dbCheck(
    await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>(),
    "List orders"
  );

  res.status(200).json({ orders });
}

// OP-14 viewOrder: GET /orders/:id
export async function viewOrder(req: Request, res: Response) {
  const user = currentUser(req);
  const order = await loadOwnOrder(user.userId, getParam(req, "id"));

  res.status(200).json({
    order: { ...order, items: await loadOrderItems(order.id) }
  });
}
