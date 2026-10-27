import type { Request, Response, NextFunction } from "express";

// Error code ตาม sheet "response" ในไฟล์ spec
const STATUS_BY_CODE = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_REQUIRED: 401,
  AUTH_FORBIDDEN: 403,
  ORDER_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  QTY_OUT_OF_RANGE: 400,
  PRODUCT_NOT_FOUND: 404,
  INSUFFICIENT_STOCK: 400,
  ITEM_NOT_IN_CART: 404,
  PRODUCT_UNAVAILABLE: 400,
  CART_EMPTY: 400,
  COUPON_INVALID: 400,
  COUPON_NOT_APPLICABLE: 400,
  WEIGHT_LIMIT_EXCEEDED: 400,
  COUPON_NOT_FOUND: 404,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
} as const;

export type ErrorCode = keyof typeof STATUS_BY_CODE;

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.status = STATUS_BY_CODE[code];
  }
}

// ใช้กับผลลัพธ์จาก supabase: ถ้า query พังให้โยน 500
export function dbCheck<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data as T;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`
  });
}

// Express 5 ส่ง error จาก async handler มาที่นี่อัตโนมัติ
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...err.details
    });
  }

  // JSON body ผิดรูปแบบ
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Request body is not valid JSON"
    });
  }

  console.error(`${req.method} ${req.path} error:`, err);

  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Internal server error"
  });
}
