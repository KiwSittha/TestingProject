import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { ORDER_STATUS, SHIPPING_FEE, USER_STAGE } from "../config/business";
import { currentUser } from "../middleware/auth.middleware";
import {
  COUPON_NOT_APPLICABLE_MESSAGE,
  assertLineAllowed,
  assertWeightAllowed,
  discountOf,
  getCartLines,
  getOrCreateCart,
  resolveCartCoupon,
  setCartCoupon,
  subtotalOf
} from "../services/cart.service";
import { ApiError, dbCheck } from "../utils/errors";
import {
  assertMatchesPath,
  getBody,
  getParam,
  optionalString,
  requireString
} from "../utils/validate";
import type { OrderItemRow, OrderRow, ProductRow } from "../types/db.types";

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
      "VALIDATION_ERROR",
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

function newOrderId(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now()}-${random}`;
}

// OP-8 pressCheckout: POST /orders/:id/payment  body { zone, speed }
// สร้างคำสั่งซื้อจากตะกร้า (:id ใน path ยังไม่มี ใช้ค่าอะไรก็ได้ เช่น "new")
async function checkout(req: Request, res: Response) {
  const user = currentUser(req);
  const body = getBody(req);
  const zone = requireString(body, "zone");
  const speed = requireString(body, "speed");
  const shippingFee = SHIPPING_FEE[zone]?.[speed];

  if (shippingFee === undefined) {
    throw new ApiError("VALIDATION_ERROR", "Invalid zone or speed", {
      allowed: Object.fromEntries(
        Object.entries(SHIPPING_FEE).map(([z, speeds]) => [z, Object.keys(speeds)])
      )
    });
  }

  const pending = dbCheck(
    await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.userId)
      .eq("status", ORDER_STATUS.PENDING_PAYMENT)
      .limit(1),
    "Load pending orders"
  );

  if (pending[0]) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "There is already an order awaiting payment, pay or cancel it first",
      { orderId: pending[0].id }
    );
  }

  const cart = await getOrCreateCart(user.userId);
  const lines = await getCartLines(cart.id);

  if (lines.length === 0) {
    throw new ApiError("CART_EMPTY", "Cart is empty");
  }

  for (const line of lines) {
    assertLineAllowed(line.product, line.quantity);
  }
  assertWeightAllowed(lines);

  const subtotal = subtotalOf(lines);
  const { coupon, removed } = await resolveCartCoupon(cart, subtotal);

  if (removed) {
    throw new ApiError("COUPON_NOT_APPLICABLE", COUPON_NOT_APPLICABLE_MESSAGE);
  }

  const discount = discountOf(subtotal, coupon);

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

  await setUserStage(user.userId, USER_STAGE.PAYMENT, order.id);

  res.status(200).json({
    message: "Order created, awaiting payment",
    order: { ...order, items }
  });
}

// OP-10 paySuccess / OP-11 payFail: POST /orders/:id/payment
// body { orderId, result: "success" | "fail" }
async function pay(req: Request, res: Response) {
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
    const failed = await updateOrderStatus(order.id, ORDER_STATUS.PAYMENT_FAILED);
    await setUserStage(user.userId, USER_STAGE.CART, null);

    res.status(200).json({
      message: "Payment failed, items are still in your cart",
      order: failed
    });
    return;
  }

  const items = await loadOrderItems(order.id);
  const products = dbCheck(
    await supabase
      .from("products")
      .select("*")
      .in("id", items.map((i) => i.product_id))
      .returns<ProductRow[]>(),
    "Load products"
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  // เช็กสต็อกทั้งหมดก่อนค่อยตัด
  for (const item of items) {
    const stock = productById.get(item.product_id)?.available_stock ?? 0;
    if (item.quantity > stock) {
      throw new ApiError(
        "INSUFFICIENT_STOCK",
        `Only ${stock} item(s) of '${item.product_id}' left in stock`,
        { productId: item.product_id, availableStock: stock }
      );
    }
  }

  for (const item of items) {
    const stock = productById.get(item.product_id)!.available_stock;
    dbCheck(
      await supabase
        .from("products")
        .update({
          available_stock: stock - item.quantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.product_id),
      "Deduct stock"
    );
  }

  const paid = await updateOrderStatus(order.id, ORDER_STATUS.PAID);

  const cart = await getOrCreateCart(user.userId);
  dbCheck(
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id)
      .in("product_id", items.map((i) => i.product_id)),
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

  const cancelled = await updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
  await setUserStage(user.userId, USER_STAGE.CART, null);

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
