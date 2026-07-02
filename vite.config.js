import { defineConfig } from "vite";

// 废土避难所 H5 经营游戏
// 单 canvas 程序化绘制,无外部美术资源
export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
