import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { COUPON_STATUS, QTY_MAX, QTY_MIN, USER_STAGE } from "../config/business";
import { currentUser } from "../middleware/auth.middleware";
import {
  COUPON_NOT_APPLICABLE_MESSAGE,
  assertLineAllowed,
  assertWeightAllowed,
  buildCartSummary,
  findCoupon,
  getCartLines,
  getOrCreateCart,
  getProduct,
  setCartCoupon,
  subtotalOf,
  withQuantity
} from "../services/cart.service";
import { ApiError, dbCheck } from "../utils/errors";
import {
  assertMatchesPath,
  getBody,
  getParam,
  optionalString,
  requireInteger,
  requireString
} from "../utils/validate";

async function saveCartItem(cartId: string, productId: string, quantity: number) {
  dbCheck(
    await supabase
      .from("cart_items")
      .upsert(
        { cart_id: cartId, product_id: productId, quantity },
        { onConflict: "cart_id,product_id" }
      ),
    "Save cart item"
  );
}

// OP-3 addItem: POST /cart/items
export async function addCartItem(req: Request, res: Response) {
  const user = currentUser(req);
  const body = getBody(req);
  const productId = requireString(body, "productId");
  const quantity = requireInteger(body, "quantity");

  if (quantity < QTY_MIN || quantity > QTY_MAX) {
    throw new ApiError(
      "QTY_OUT_OF_RANGE",
      `Quantity must be between ${QTY_MIN} and ${QTY_MAX}`,
      { productId, quantity }
    );
  }

  const product = await getProduct(productId);
  const cart = await getOrCreateCart(user.userId);
  const lines = await getCartLines(cart.id);
  const inCart = lines.find((l) => l.product.id === productId)?.quantity ?? 0;
  const newQuantity = inCart + quantity;

  assertLineAllowed(product, newQuantity);
  assertWeightAllowed(withQuantity(lines, product, newQuantity));

  await saveCartItem(cart.id, productId, newQuantity);

  res.status(200).json({
    message: "Item added to cart",
    cart: await buildCartSummary(cart)
  });
}

// OP-4 updateQuantity: PATCH /cart/items/:id
export async function updateCartItem(req: Request, res: Response) {
  const user = currentUser(req);
  const productId = getParam(req, "id");
  const body = getBody(req);
  assertMatchesPath(optionalString(body, "productId"), productId, "productId");
  const quantity = requireInteger(body, "quantity");

  const cart = await getOrCreateCart(user.userId);
  const lines = await getCartLines(cart.id);
  const line = lines.find((l) => l.product.id === productId);

  if (!line) {
    throw new ApiError("ITEM_NOT_IN_CART", `Product '${productId}' is not in the cart`);
  }

  assertLineAllowed(line.product, quantity);
  assertWeightAllowed(withQuantity(lines, line.product, quantity));

  await saveCartItem(cart.id, productId, quantity);

  res.status(200).json({
    message: "Cart item updated",
    cart: await buildCartSummary(cart)
  });
}

// OP-5 removeItem: DELETE /cart/items/:id
export async function removeCartItem(req: Request, res: Response) {
  const user = currentUser(req);
  const productId = getParam(req, "id");
  assertMatchesPath(optionalString(getBody(req), "productId"), productId, "productId");

  const cart = await getOrCreateCart(user.userId);
  const deleted = dbCheck(
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id)
      .eq("product_id", productId)
      .select("product_id"),
    "Remove cart item"
  );

  if (deleted.length === 0) {
    throw new ApiError("ITEM_NOT_IN_CART", `Product '${productId}' is not in the cart`);
  }

  res.status(200).json({
    message: "Item removed from cart",
    cart: await buildCartSummary(cart)
  });
}

// OP-6 applyCoupon: PUT /cart/items
export async function applyCoupon(req: Request, res: Response) {
  const user = currentUser(req);
  const code = requireString(getBody(req), "code");

  const cart = await getOrCreateCart(user.userId);
  const lines = await getCartLines(cart.id);

  if (lines.length === 0) {
    throw new ApiError("CART_EMPTY", "Cart is empty");
  }

  const coupon = await findCoupon(code);

  if (!coupon) {
    throw new ApiError("COUPON_NOT_FOUND", `Coupon '${code}' not found`);
  }

  if (coupon.status !== COUPON_STATUS.ACTIVE) {
    throw new ApiError("COUPON_INVALID", `Coupon '${code}' is not available`);
  }

  const subtotal = subtotalOf(lines);

  if (subtotal < coupon.min_spend) {
    await setCartCoupon(cart.id, null);
    throw new ApiError("COUPON_NOT_APPLICABLE", COUPON_NOT_APPLICABLE_MESSAGE, {
      subtotal,
      minSpend: coupon.min_spend
    });
  }

  await setCartCoupon(cart.id, coupon.code);
  cart.applied_coupon_code = coupon.code;

  res.status(200).json({
    message: "Coupon applied",
    cart: await buildCartSummary(cart)
  });
}

// OP-7 ViewCart / OP-12 continueShopping: GET /cart
export async function viewCart(req: Request, res: Response) {
  const user = currentUser(req);

  // กลับมาซื้อต่อหลังชำระเงินสำเร็จ -> รีเซ็ตสถานะผู้ใช้กลับเป็นตะกร้า
  dbCheck(
    await supabase
      .from("users")
      .update({ current_stage: USER_STAGE.CART, current_order_id: null })
      .eq("id", user.userId)
      .eq("current_stage", USER_STAGE.COMPLETED),
    "Reset user stage"
  );

  const cart = await getOrCreateCart(user.userId);

  res.status(200).json({
    cart: await buildCartSummary(cart)
  });
}
