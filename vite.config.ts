/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 前端 dev server：5173；/api 与 /bookmarklet.js 反向代理到后端 5175
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5175',
      '/bookmarklet.js': 'http://localhost:5175',
    },
  },
  // vitest 配置：默认 jsdom（前端组件测试），服务端测试文件顶部加
  // // @vitest-environment node 切到 node 环境（见 docs/api-contract.md）
  test: {
    environment: 'jsdom',
    include: ['server/**/*.test.js', 'src/**/*.spec.ts'],
  },
});
