import { defineConfig } from "vitest/config";

// แยกจาก vite.config.ts เพื่อไม่ให้โหลด plugin ของ frontend ตอนรัน unit test
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**/*.ts", "src/utils/**/*.ts"],
      reporter: ["text", "html"]
    }
  }
});
