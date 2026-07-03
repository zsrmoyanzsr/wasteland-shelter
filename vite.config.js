import { defineConfig } from "vite";

// 废土避难所 H5 经营游戏
// 单 canvas 程序化绘制,无外部美术资源
// base: GitHub Pages 部署在 /wasteland-shelter/ 子路径下,必须配置否则资源404
// 本地开发(vite dev/preview)不受影响(用相对路径兜底)
export default defineConfig({
  base: process.env.GH_PAGES ? "/wasteland-shelter/" : "./",
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
