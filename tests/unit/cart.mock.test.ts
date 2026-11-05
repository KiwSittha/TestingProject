import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// แทน client จริงด้วย from ที่เป็น vi.fn() เพื่อตรวจว่า service เรียก DB อย่างไร
vi.mock("../../src/config/supabase", () => ({ supabase: { from: vi.fn() } }));

import { supabase } from "../../src/config/supabase";
import { COUPON_STATUS } from "../../src/config/business";
import {
  getOrCreateCart,
  resolveCartCoupon,
  setCartCoupon
} from "../../src/services/cart.service";
import type { CartRow, CouponRow } from "../../src/types/db.types";
import { stubQuery } from "./helpers/supabase-stub";

const from = supabase.from as unknown as Mock;

// ---------- Test data builders ----------

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

// ผลของ update ที่สำเร็จ (ไม่มี data)
const UPDATE_OK = { data: null, error: null };

beforeEach(() => {
  from.mockReset();
});

// ---------- resolveCartCoupon ----------

describe("resolveCartCoupon (mock: carts.update)", () => {
  it("MK-01: coupon not applicable (subtotal < min_spend) -> clear coupon on carts", async () => {
    // Arrange
    const coupon = makeCoupon({ min_spend: 500 });
    const cart = makeCart({ id: "C001", applied_coupon_code: coupon.code });
    const couponQuery = stubQuery({ data: coupon, error: null });
    const updateQuery = stubQuery(UPDATE_OK);
    from.mockReturnValueOnce(couponQuery).mockReturnValueOnce(updateQuery);

    // Act
    const result = await resolveCartCoupon(cart, 499);

    // Assert
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(1, "coupons");
    expect(from).toHaveBeenNthCalledWith(2, "carts");
    expect(updateQuery.update).toHaveBeenCalledTimes(1);
    expect(updateQuery.update).toHaveBeenCalledWith({
      applied_coupon_code: null,
      updated_at: expect.any(String)
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "C001");
    expect(result).toEqual({ coupon: null, removed: true });
  });

  it("MK-02: coupon applicable -> update is not called", async () => {
    // Arrange
    const coupon = makeCoupon({ min_spend: 500 });
    const cart = makeCart({ applied_coupon_code: coupon.code });
    const couponQuery = stubQuery({ data: coupon, error: null });
    from.mockReturnValueOnce(couponQuery);

    // Act
    const result = await resolveCartCoupon(cart, 500);

    // Assert
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("coupons");
    expect(from).not.toHaveBeenCalledWith("carts");
    expect(couponQuery.update).not.toHaveBeenCalled();
    expect(result).toEqual({ coupon, removed: false });
  });

  it("MK-03: cart has no coupon -> supabase.from is never called", async () => {
    // Arrange
    const cart = makeCart({ applied_coupon_code: null });

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ coupon: null, removed: false });
  });

  it("MK-07: coupon code not found in DB -> clear coupon on carts", async () => {
    // Arrange
    const cart = makeCart({ id: "C001", applied_coupon_code: "GONE99" });
    const couponQuery = stubQuery<CouponRow>({ data: null, error: null });
    const updateQuery = stubQuery(UPDATE_OK);
    from.mockReturnValueOnce(couponQuery).mockReturnValueOnce(updateQuery);

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(1, "coupons");
    expect(couponQuery.eq).toHaveBeenCalledWith("code", "GONE99");
    expect(from).toHaveBeenNthCalledWith(2, "carts");
    expect(updateQuery.update).toHaveBeenCalledTimes(1);
    expect(updateQuery.update).toHaveBeenCalledWith({
      applied_coupon_code: null,
      updated_at: expect.any(String)
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "C001");
    expect(result).toEqual({ coupon: null, removed: true });
  });

  it("MK-08: coupon inactive (subtotal >= min_spend) -> clear coupon on carts", async () => {
    // Arrange
    const coupon = makeCoupon({ min_spend: 500, status: COUPON_STATUS.INACTIVE });
    const cart = makeCart({ id: "C001", applied_coupon_code: coupon.code });
    const couponQuery = stubQuery({ data: coupon, error: null });
    const updateQuery = stubQuery(UPDATE_OK);
    from.mockReturnValueOnce(couponQuery).mockReturnValueOnce(updateQuery);

    // Act
    const result = await resolveCartCoupon(cart, 1000);

    // Assert
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(1, "coupons");
    expect(from).toHaveBeenNthCalledWith(2, "carts");
    expect(updateQuery.update).toHaveBeenCalledTimes(1);
    expect(updateQuery.update).toHaveBeenCalledWith({
      applied_coupon_code: null,
      updated_at: expect.any(String)
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "C001");
    expect(result).toEqual({ coupon: null, removed: true });
  });
});

// ---------- getOrCreateCart ----------

describe("getOrCreateCart (mock: carts.insert)", () => {
  it("MK-04: cart already exists -> insert is not called", async () => {
    // Arrange
    const existing = makeCart({ id: "C001", user_id: "U001" });
    const loadQuery = stubQuery({ data: existing, error: null });
    from.mockReturnValueOnce(loadQuery);

    // Act
    const result = await getOrCreateCart("U001");

    // Assert
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("carts");
    expect(loadQuery.eq).toHaveBeenCalledWith("user_id", "U001");
    expect(loadQuery.insert).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it("MK-05: no cart yet -> insert is called with { user_id }", async () => {
    // Arrange
    const created = makeCart({ id: "C999", user_id: "U001" });
    const loadQuery = stubQuery({ data: null, error: null });
    const insertQuery = stubQuery({ data: created, error: null });
    from.mockReturnValueOnce(loadQuery).mockReturnValueOnce(insertQuery);

    // Act
    const result = await getOrCreateCart("U001");

    // Assert
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(2, "carts");
    expect(loadQuery.insert).not.toHaveBeenCalled();
    expect(insertQuery.insert).toHaveBeenCalledTimes(1);
    expect(insertQuery.insert).toHaveBeenCalledWith({ user_id: "U001" });
    expect(insertQuery.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(created);
  });
});

// ---------- setCartCoupon ----------

describe("setCartCoupon (mock: carts.update)", () => {
  it("MK-06: update is called with the given code and eq('id', cartId)", async () => {
    // Arrange
    const updateQuery = stubQuery(UPDATE_OK);
    from.mockReturnValueOnce(updateQuery);

    // Act
    await setCartCoupon("C001", "SAVE10");

    // Assert
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("carts");
    expect(updateQuery.update).toHaveBeenCalledTimes(1);
    expect(updateQuery.update).toHaveBeenCalledWith({
      applied_coupon_code: "SAVE10",
      updated_at: expect.any(String)
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "C001");
  });
});
