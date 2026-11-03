import { vi, type Mock } from "vitest";

// Stub ของ query builder ใน supabase-js: ทุก query คืน result ที่กำหนดไว้
// ใช้คู่กับ vi.mocked(supabase.from).mockReturnValueOnce(stubQuery(...))
// ทุก method เป็น vi.fn() เพื่อให้ test แบบ Mock ตรวจการเรียกได้ (test แบบ Stub ไม่ต้องสนใจ)

// รูปแบบเดียวกับที่ dbCheck รับ
export interface StubResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface QueryStub<T = unknown> extends PromiseLike<StubResult<T>> {
  select: Mock<(...args: unknown[]) => QueryStub<T>>;
  insert: Mock<(...args: unknown[]) => QueryStub<T>>;
  update: Mock<(...args: unknown[]) => QueryStub<T>>;
  eq: Mock<(...args: unknown[]) => QueryStub<T>>;
  order: Mock<(...args: unknown[]) => QueryStub<T>>;
  returns: Mock<(...args: unknown[]) => QueryStub<T>>;
  maybeSingle: Mock<(...args: unknown[]) => Promise<StubResult<T>>>;
  single: Mock<(...args: unknown[]) => Promise<StubResult<T>>>;
}

export function stubQuery<T>(result: StubResult<T>): QueryStub<T> {
  const builder: QueryStub<T> = {
    // method ที่ต่อ chain ได้ คืนตัวเอง
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn(() => builder),
    // method ปลายทาง คืน Promise ของ result
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    // ทำให้ await builder ได้ตรง ๆ (เช่น await หลัง .returns() หรือ .eq())
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
  };
  return builder;
}
