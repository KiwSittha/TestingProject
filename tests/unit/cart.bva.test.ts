import { describe, expect, it, vi } from "vitest";

// supabase.ts จะ throw ถ้าไม่มี env และฟังก์ชันที่ทดสอบในไฟล์นี้ไม่ได้ใช้ DB
vi.mock("../../src/config/supabase", () => ({ supabase: {} }));

import {
  COUPON_STATUS,
  MAX_CART_WEIGHT_GRAM,
  PRODUCT_STATUS,
  QTY_MAX,
  QTY_MIN
} from "../../src/config/business";
import {
  assertLineAllowed,
  assertWeightAllowed,
  discountOf,
  isCouponApplicable,
  withQuantity,
  type CartLine
} from "../../src/services/cart.service";
import { ApiError, type ErrorCode } from "../../src/utils/errors";
import type { CouponRow, ProductRow } from "../../src/types/db.types";

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

// รันฟังก์ชันแล้วคืน error ที่ถูก throw (หรือ undefined ถ้าไม่ throw)
function captureError(fn: () => void): unknown {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error;
  }
}

function expectApiError(error: unknown, code: ErrorCode) {
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
}

// ---------- assertLineAllowed: quantity (ขอบสองด้าน QTY_MIN..QTY_MAX) ----------

const QTY_NOM = Math.floor((QTY_MIN + QTY_MAX) / 2);

describe("assertLineAllowed - quantity range [QTY_MIN, QTY_MAX]", () => {
  it.each([
    { id: "BVA-01", label: "min-", quantity: QTY_MIN - 1, expected: "QTY_OUT_OF_RANGE" as const, outcome: "QTY_OUT_OF_RANGE" },
    { id: "BVA-02", label: "min", quantity: QTY_MIN, expected: null, outcome: "pass" },
    { id: "BVA-03", label: "min+", quantity: QTY_MIN + 1, expected: null, outcome: "pass" },
    { id: "BVA-04", label: "nom", quantity: QTY_NOM, expected: null, outcome: "pass" },
    { id: "BVA-05", label: "max-", quantity: QTY_MAX - 1, expected: null, outcome: "pass" },
    { id: "BVA-06", label: "max", quantity: QTY_MAX, expected: null, outcome: "pass" },
    { id: "BVA-07", label: "max+", quantity: QTY_MAX + 1, expected: "QTY_OUT_OF_RANGE" as const, outcome: "QTY_OUT_OF_RANGE" }
  ])(
    "$id: quantity = $quantity ($label) -> $outcome",
    ({ quantity, expected }) => {
      // Arrange
      const product = makeProduct({ available_stock: 100 });

      // Act
      const error = captureError(() => assertLineAllowed(product, quantity));

      // Assert
      if (expected === null) {
        expect(error).toBeUndefined();
      } else {
        expectApiError(error, expected);
      }
    }
  );
});

// ---------- assertLineAllowed: stock (ขอบด้านเดียว quantity <= available_stock) ----------

const STOCK = 5;

describe("assertLineAllowed - quantity vs available_stock", () => {
  it.each([
    { id: "BVA-08", label: "stock-1", quantity: STOCK - 1, expected: null, outcome: "pass" },
    { id: "BVA-09", label: "stock", quantity: STOCK, expected: null, outcome: "pass" },
    { id: "BVA-10", label: "stock+1", quantity: STOCK + 1, expected: "INSUFFICIENT_STOCK" as const, outcome: "INSUFFICIENT_STOCK" }
  ])(
    "$id: stock = 5, quantity = $quantity ($label) -> $outcome",
    ({ quantity, expected }) => {
      // Arrange
      const product = makeProduct({ available_stock: STOCK });

      // Act
      const error = captureError(() => assertLineAllowed(product, quantity));

      // Assert
      if (expected === null) {
        expect(error).toBeUndefined();
      } else {
        expectApiError(error, expected);
      }
    }
  );
});

// ---------- assertWeightAllowed: น้ำหนักรวม (ขอบด้านเดียว <= MAX_CART_WEIGHT_GRAM) ----------

describe("assertWeightAllowed - total weight <= MAX_CART_WEIGHT_GRAM", () => {
  it.each([
    { id: "BVA-11", label: "max-1", totalWeight: MAX_CART_WEIGHT_GRAM - 1, expected: null, outcome: "pass" },
    { id: "BVA-12", label: "max", totalWeight: MAX_CART_WEIGHT_GRAM, expected: null, outcome: "pass" },
    { id: "BVA-13", label: "max+1", totalWeight: MAX_CART_WEIGHT_GRAM + 1, expected: "WEIGHT_LIMIT_EXCEEDED" as const, outcome: "WEIGHT_LIMIT_EXCEEDED" }
  ])(
    "$id: total weight = $totalWeight g ($label) -> $outcome",
    ({ totalWeight, expected }) => {
      // Arrange
      const lines: CartLine[] = [
        { product: makeProduct({ weight_gram: totalWeight }), quantity: 1 }
      ];

      // Act
      const error = captureError(() => assertWeightAllowed(lines));

      // Assert
      if (expected === null) {
        expect(error).toBeUndefined();
      } else {
        expectApiError(error, expected);
      }
    }
  );
});

// ---------- isCouponApplicable: subtotal (ขอบด้านเดียว subtotal >= min_spend) ----------

const MIN_SPEND = 500;

describe("isCouponApplicable - subtotal >= min_spend", () => {
  it.each([
    { id: "BVA-14", label: "min_spend-1", subtotal: MIN_SPEND - 1, expected: false },
    { id: "BVA-15", label: "min_spend", subtotal: MIN_SPEND, expected: true },
    { id: "BVA-16", label: "min_spend+1", subtotal: MIN_SPEND + 1, expected: true }
  ])(
    "$id: min_spend = 500, subtotal = $subtotal ($label) -> $expected",
    ({ subtotal, expected }) => {
      // Arrange
      const coupon = makeCoupon({ min_spend: MIN_SPEND, status: COUPON_STATUS.ACTIVE });

      // Act
      const result = isCouponApplicable(coupon, subtotal);

      // Assert
      expect(result).toBe(expected);
    }
  );
});

// ---------- discountOf: คูปอง 10% (ขอบการปัดเศษที่ 1000 และขอบล่าง 0) ----------

describe("discountOf - 10% coupon", () => {
  it.each([
    { id: "BVA-17", label: "1000-1", subtotal: 999, expected: 99 },
    { id: "BVA-18", label: "1000", subtotal: 1000, expected: 100 },
    { id: "BVA-19", label: "1000+1", subtotal: 1001, expected: 100 },
    { id: "BVA-20", label: "zero", subtotal: 0, expected: 0 }
  ])(
    "$id: subtotal = $subtotal ($label) -> discount $expected",
    ({ subtotal, expected }) => {
      // Arrange
      const coupon = makeCoupon({ percent: 10 });

      // Act
      const result = discountOf(subtotal, coupon);

      // Assert
      expect(result).toBe(expected);
    }
  );
});

// ---------- withQuantity: quantity (ขอบด้านเดียว ต้อง >= QTY_MIN ถึงจะเก็บไว้) ----------

describe("withQuantity - remove line when quantity drops below QTY_MIN", () => {
  it("BVA-21: quantity = 0 -> line removed", () => {
    // Arrange
    const target = makeProduct({ id: "P001" });
    const other = makeProduct({ id: "P002" });
    const lines: CartLine[] = [
      { product: target, quantity: 3 },
      { product: other, quantity: 2 }
    ];

    // Act
    const result = withQuantity(lines, target, QTY_MIN - 1);

    // Assert
    expect(result.map((l) => l.product.id)).toEqual(["P002"]);
  });

  it("BVA-22: quantity = 1 -> line kept with quantity 1", () => {
    // Arrange
    const target = makeProduct({ id: "P001" });
    const other = makeProduct({ id: "P002" });
    const lines: CartLine[] = [
      { product: target, quantity: 3 },
      { product: other, quantity: 2 }
    ];

    // Act
    const result = withQuantity(lines, target, QTY_MIN);

    // Assert
    expect(result).toHaveLength(2);
    expect(result.find((l) => l.product.id === "P001")?.quantity).toBe(QTY_MIN);
  });
});
