import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// แทน client จริงด้วย from ที่เป็น vi.fn() แต่ละ test จะ stub ค่าที่ DB คืนเอง
vi.mock("../../src/config/supabase", () => ({ supabase: { from: vi.fn() } }));

import { supabase } from "../../src/config/supabase";
import { COUPON_STATUS, PRODUCT_STATUS } from "../../src/config/business";
import {
  buildCartSummary,
  COUPON_NOT_APPLICABLE_MESSAGE,
  getProduct,
  resolveCartCoupon
} from "../../src/services/cart.service";
import { ApiError } from "../../src/utils/errors";
import type { CartRow, CouponRow, ProductRow } from "../../src/types/db.types";
import { stubQuery } from "./helpers/supabase-stub";

const from = supabase.from as unknown as Mock;

// ---------- Test data builders ----------

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "P001",
    name: "Test product",
    price: 100,
    weight_gram: 500,
    available_stock: 100,
    status: PRODUCT_STATUS.ON_SALE,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makeCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    code: "SAVE10",
    percent: 10,
    min_spend: 500,
    status: COUPON_STATUS.ACTIVE,
    ...overrides
  };
}

function makeCart(overrides: Partial<CartRow> = {}): CartRow {
  return {
    id: "C001",
    user_id: "U001",
    applied_coupon_code: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

// แถวที่ getCartLines ได้จาก cart_items join products
function cartItemRow(product: ProductRow, quantity: number) {
  return { product_id: product.id, quantity, products: product };
}

// ผลของ setCartCoupon (update สำเร็จ ไม่มี data)
const UPDATE_OK = { data: null, error: null };

beforeEach(() => {
  from.mockReset();
});

// ---------- getProduct ----------

describe("getProduct (stub: products.maybeSingle)", () => {
  it("ST-01: DB returns data null -> throw PRODUCT_NOT_FOUND", async () => {
    // Arrange
    from.mockReturnValueOnce(stubQuery({ data: null, error: null }));

    // Act
    const error = await getProduct("P404").catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("PRODUCT_NOT_FOUND");
  });

  it("ST-02: DB returns a product -> return that product", async () => {
    // Arrange
    const product = makeProduct({ id: "P001", name: "Keyboard", price: 990 });
    from.mockReturnValueOnce(stubQuery({ data: product, error: null }));

    // Act
    const result = await getProduct("P001");

    // Assert
    expect(result).toEqual(product);
  });

  it("ST-03: DB returns error { message } -> throw Error from dbCheck", async () => {
    // Arrange
    from.mockReturnValueOnce(
      stubQuery({ data: null, error: { message: "connection refused" } })
    );

    // Act
    const error = await getProduct("P001").catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as Error).message).toBe("Load product: connection refused");
  });
});

// ---------- resolveCartCoupon ----------

describe("resolveCartCoupon (stub: coupons.maybeSingle, carts.update)", () => {
  it("ST-04: cart has no coupon -> { coupon: null, removed: false }", async () => {
    // Arrange
    const cart = makeCart({ applied_coupon_code: null });

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(result).toEqual({ coupon: null, removed: false });
  });

  it("ST-05: coupon not found in DB -> { coupon: null, removed: true }", async () => {
    // Arrange
    const cart = makeCart({ applied_coupon_code: "GHOST" });
    from
      .mockReturnValueOnce(stubQuery({ data: null, error: null }))
      .mockReturnValueOnce(stubQuery(UPDATE_OK));

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(result).toEqual({ coupon: null, removed: true });
  });

  it.each([
    { id: "ST-06", label: "min_spend-1", subtotal: 499, removed: true },
    { id: "ST-07", label: "min_spend", subtotal: 500, removed: false },
    { id: "ST-08", label: "min_spend+1", subtotal: 501, removed: false }
  ])(
    "$id: active coupon, min_spend 500, subtotal $subtotal ($label) -> removed $removed",
    async ({ subtotal, removed }) => {
      // Arrange
      const coupon = makeCoupon({ min_spend: 500, status: COUPON_STATUS.ACTIVE });
      const cart = makeCart({ applied_coupon_code: coupon.code });
      from
        .mockReturnValueOnce(stubQuery({ data: coupon, error: null }))
        .mockReturnValueOnce(stubQuery(UPDATE_OK));

      // Act
      const result = await resolveCartCoupon(cart, subtotal);

      // Assert
      expect(result).toEqual({ coupon: removed ? null : coupon, removed });
    }
  );

  it("ST-09: coupon status inactive -> removed true", async () => {
    // Arrange
    const coupon = makeCoupon({ min_spend: 500, status: COUPON_STATUS.INACTIVE });
    const cart = makeCart({ applied_coupon_code: coupon.code });
    from
      .mockReturnValueOnce(stubQuery({ data: coupon, error: null }))
      .mockReturnValueOnce(stubQuery(UPDATE_OK));

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(result).toEqual({ coupon: null, removed: true });
  });
});

// ---------- buildCartSummary ----------

describe("buildCartSummary (stub: cart_items, coupons, carts.update)", () => {
  it("ST-10: 2 items with 10% coupon -> totals are correct", async () => {
    // Arrange
    // P001: 250 x 2 = 500 บาท, 500 g x 2 = 1000 g
    // P002: 120 x 3 = 360 บาท, 300 g x 3 =  900 g
    const p1 = makeProduct({ id: "P001", name: "Mouse", price: 250, weight_gram: 500 });
    const p2 = makeProduct({ id: "P002", name: "Pad", price: 120, weight_gram: 300 });
    const coupon = makeCoupon({ code: "SAVE10", percent: 10, min_spend: 500 });
    const cart = makeCart({ applied_coupon_code: coupon.code });
    from
      .mockReturnValueOnce(
        stubQuery({ data: [cartItemRow(p1, 2), cartItemRow(p2, 3)], error: null })
      )
      .mockReturnValueOnce(stubQuery({ data: coupon, error: null }))
      .mockReturnValueOnce(stubQuery({ data: { member_tier: "normal" }, error: null }));

    // Act
    const summary = await buildCartSummary(cart);

    // Assert
    expect(summary).toMatchObject({
      cartId: "C001",
      subtotal: 860,
      discount: 86,
      total: 774,
      totalQuantity: 5,
      totalWeightGram: 1900,
      coupon: { code: "SAVE10", percent: 10, minSpend: 500 }
    });
    expect(summary.notice).toBeUndefined();
  });

  it("ST-11: coupon no longer applicable -> notice = COUPON_NOT_APPLICABLE_MESSAGE", async () => {
    // Arrange
    // subtotal 100 x 2 = 200 < min_spend 500
    const product = makeProduct({ id: "P001", price: 100 });
    const coupon = makeCoupon({ min_spend: 500 });
    const cart = makeCart({ applied_coupon_code: coupon.code });
    from
      .mockReturnValueOnce(stubQuery({ data: [cartItemRow(product, 2)], error: null }))
      .mockReturnValueOnce(stubQuery({ data: coupon, error: null }))
      .mockReturnValueOnce(stubQuery(UPDATE_OK))
      .mockReturnValueOnce(stubQuery({ data: { member_tier: "normal" }, error: null }));

    // Act
    const summary = await buildCartSummary(cart);

    // Assert
    expect(summary.notice).toBe(COUPON_NOT_APPLICABLE_MESSAGE);
    expect(summary.coupon).toBeNull();
    expect(summary.discount).toBe(0);
    expect(summary.total).toBe(200);
  });

  it("ST-12: prime customer without an applicable coupon gets a 5% discount", async () => {
    const product = makeProduct({ id: "P001", price: 1650 });
    const cart = makeCart();
    from
      .mockReturnValueOnce(stubQuery({ data: [cartItemRow(product, 1)], error: null }))
      .mockReturnValueOnce(stubQuery({ data: { member_tier: "prime" }, error: null }));

    const summary = await buildCartSummary(cart);

    expect(summary.discount).toBe(82);
    expect(summary.total).toBe(1568);
  });
});
