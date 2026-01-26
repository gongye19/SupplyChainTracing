import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';

// 在 Vercel 构建环境中，使用临时目录作为 envDir，避免读取项目目录下的 .env.local
// 在本地开发环境，使用当前目录
const getEnvDir = () => {
  // 检测是否在 Vercel 构建环境中
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    try {
      // 使用系统临时目录，确保有写入权限
      const tempDir = path.join(tmpdir(), 'vite-env-' + Date.now());
      if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
      }
      return tempDir;
    } catch (e) {
      console.warn('Failed to create temp env dir, using current directory:', e);
      return process.cwd();
    }
  }
  // 本地开发环境，使用当前目录
  return process.cwd();
};

export default defineConfig({
    // 使用 envPrefix 限制只加载 VITE_ 前缀的环境变量
    envPrefix: ['VITE_'],
    // 设置 envDir，在 Vercel 上使用临时目录
    envDir: getEnvDir(),
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
      react()
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
