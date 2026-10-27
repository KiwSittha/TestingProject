import type { Request, Response } from "express";
import { supabase } from "../config/supabase";
import { COUPON_STATUS, PRODUCT_STATUS } from "../config/business";
import { getProduct } from "../services/cart.service";
import { ApiError, dbCheck } from "../utils/errors";
import {
  assertMatchesPath,
  getBody,
  getParam,
  optionalInteger,
  optionalString
} from "../utils/validate";
import type { CouponRow, ProductRow } from "../types/db.types";

async function updateProductRow(
  productId: string,
  changes: Partial<ProductRow>
): Promise<ProductRow> {
  return dbCheck(
    await supabase
      .from("products")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select("*")
      .single<ProductRow>(),
    "Update product"
  );
}

// OP-15 updateProduct: PATCH /admin/products/:id/update  body { productId?, price?, stock? }
export async function updateProduct(req: Request, res: Response) {
  const productId = getParam(req, "id");
  const body = getBody(req);
  assertMatchesPath(optionalString(body, "productId"), productId, "productId");
  const price = optionalInteger(body, "price");
  const stock = optionalInteger(body, "stock");

  if (price === undefined && stock === undefined) {
    throw new ApiError("VALIDATION_ERROR", "Provide 'price' and/or 'stock'");
  }
  if (price !== undefined && price <= 0) {
    throw new ApiError("VALIDATION_ERROR", "'price' must be greater than 0");
  }
  if (stock !== undefined && stock < 0) {
    throw new ApiError("VALIDATION_ERROR", "'stock' must not be negative");
  }

  await getProduct(productId);

  const changes: Partial<ProductRow> = {};
  if (price !== undefined) changes.price = price;
  if (stock !== undefined) changes.available_stock = stock;

  res.status(200).json({
    message: "Product updated",
    product: await updateProductRow(productId, changes)
  });
}

// OP-16 setProductStatus: PATCH /admin/products/:id/set  body { productId?, status }
export async function setProductStatus(req: Request, res: Response) {
  const productId = getParam(req, "id");
  const body = getBody(req);
  assertMatchesPath(optionalString(body, "productId"), productId, "productId");
  const allowed: string[] = Object.values(PRODUCT_STATUS);
  const status = body.status;

  if (typeof status !== "string" || !allowed.includes(status)) {
    throw new ApiError("VALIDATION_ERROR", "Invalid product status", { allowed });
  }

  await getProduct(productId);

  res.status(200).json({
    message: "Product status updated",
    product: await updateProductRow(productId, { status })
  });
}

// spec กำหนด status เป็น Number: 1 = เปิดใช้, 0 = ปิดใช้ (รับข้อความไทยได้ด้วย)
function parseCouponStatus(value: unknown): string {
  if (value === 1 || value === COUPON_STATUS.ACTIVE) return COUPON_STATUS.ACTIVE;
  if (value === 0 || value === COUPON_STATUS.INACTIVE) return COUPON_STATUS.INACTIVE;

  throw new ApiError("VALIDATION_ERROR", "Invalid coupon status", {
    allowed: [1, 0, COUPON_STATUS.ACTIVE, COUPON_STATUS.INACTIVE]
  });
}

// OP-17 setCouponStatus: PATCH /admin/coupons/:id/set  body { code?, status }
export async function setCouponStatus(req: Request, res: Response) {
  const code = getParam(req, "id");
  const body = getBody(req);
  assertMatchesPath(optionalString(body, "code"), code, "code");
  const status = parseCouponStatus(body.status);

  const updated = dbCheck(
    await supabase
      .from("coupons")
      .update({ status })
      .eq("code", code)
      .select("*")
      .returns<CouponRow[]>(),
    "Update coupon"
  );

  if (!updated[0]) {
    throw new ApiError("COUPON_NOT_FOUND", `Coupon '${code}' not found`);
  }

  res.status(200).json({
    message: "Coupon status updated",
    coupon: updated[0]
  });
}

// OP-18 listCoupons: GET /admin/coupons
export async function listCoupons(_req: Request, res: Response) {
  const coupons = dbCheck(
    await supabase.from("coupons").select("*").order("code").returns<CouponRow[]>(),
    "List coupons"
  );

  res.status(200).json({ coupons });
}
