import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';

export default defineConfig({
    // 使用临时目录作为 envDir，避免读取项目目录下的 .env.local
    // 在 Vercel 构建时，环境变量通过 Vercel 的环境变量配置设置，不需要 .env.local
    envDir: (() => {
      // 在构建环境中（如 Vercel），使用临时目录
      if (process.env.VERCEL || process.env.CI) {
        try {
          const tempDir = path.join(tmpdir(), 'vite-env');
          if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
          }
          return tempDir;
        } catch (e) {
          // 如果失败，回退到当前目录
          return process.cwd();
        }
      }
      // 在本地开发环境，使用当前目录
      return process.cwd();
    })(),
    // 使用 envPrefix 限制只加载 VITE_ 前缀的环境变量
    envPrefix: ['VITE_'],
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:8001',
          changeOrigin: true,
        }
      }
    },
    plugins: [
      react(),
      envPlugin()
    ],
    define: {
      // 直接使用 process.env，Vite 会自动处理环境变量
      'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});
