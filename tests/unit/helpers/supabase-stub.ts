// Stub ของ query builder ใน supabase-js: ทุก query คืน result ที่กำหนดไว้
// ใช้คู่กับ vi.mocked(supabase.from).mockReturnValueOnce(stubQuery(...))

// รูปแบบเดียวกับที่ dbCheck รับ
export interface StubResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface QueryStub<T = unknown> extends PromiseLike<StubResult<T>> {
  select: (...args: unknown[]) => QueryStub<T>;
  insert: (...args: unknown[]) => QueryStub<T>;
  update: (...args: unknown[]) => QueryStub<T>;
  eq: (...args: unknown[]) => QueryStub<T>;
  order: (...args: unknown[]) => QueryStub<T>;
  returns: (...args: unknown[]) => QueryStub<T>;
  maybeSingle: (...args: unknown[]) => Promise<StubResult<T>>;
  single: (...args: unknown[]) => Promise<StubResult<T>>;
}

export function stubQuery<T>(result: StubResult<T>): QueryStub<T> {
  const builder: QueryStub<T> = {
    // method ที่ต่อ chain ได้ คืนตัวเอง
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    order: () => builder,
    returns: () => builder,
    // method ปลายทาง คืน Promise ของ result
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    // ทำให้ await builder ได้ตรง ๆ (เช่น await หลัง .returns() หรือ .eq())
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
  };
  return builder;
}
