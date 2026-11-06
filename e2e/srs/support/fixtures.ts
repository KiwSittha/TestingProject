import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { ApiActor, resetToSeed } from './api';
import { login } from './ui';
import type { Username } from './seed';

type Fixtures = {
  // DC-3.1: reset ข้อมูลกลับเป็น seed ก่อนทุก test (auto)
  seedData: void;
  // เปิด browser context ใหม่ของผู้ใช้คนนั้นแล้ว login ผ่านหน้าเว็บ
  // ผู้ใช้แต่ละคนมี context แยก (localStorage, cookie ไม่ปนกัน) และปิดให้เองหลัง test
  // เรียกซ้ำกับบัญชีเดิม = login ครั้งถัดไปของบัญชีเดียวกัน (FR-1.2)
  loginAs: (username: Username) => Promise<Page>;
  // เตรียม Given ผ่าน API (ไม่ใช่ขั้นที่ถูกทดสอบ)
  given: (username: Username) => Promise<ApiActor>;
};

export const test = base.extend<Fixtures>({
  seedData: [
    async ({ request }, use) => {
      await resetToSeed(request);
      await use();
    },
    { auto: true },
  ],

  loginAs: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (username) => {
      // context ที่สร้างเองไม่รับค่า use ของ config จึงส่ง baseURL ให้เอง
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      const page = await context.newPage();
      await login(page, username);
      return page;
    });
    for (const context of contexts) await context.close().catch(() => {});
  },

  given: async ({ request }, use) => {
    await use((username) => ApiActor.login(request, username));
  },
});

export { expect } from '@playwright/test';
