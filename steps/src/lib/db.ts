import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global {
  var prismaSteps: PrismaClient | undefined;
}

// 1. 获取数据库绝对路径
// 使用 process.cwd() 配合相对路径通常在 tsx/Next.js 环境下更稳健
const dbDir = path.resolve(process.cwd(), 'prisma');
const dbPath = path.join(dbDir, 'dev.db');

// 2. 预检：如果目录不存在则创建它
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 3. 创建 Prisma 适配器 (注意：Prisma 7 之后使用 PrismaBetterSqlite3 且接收 url 配置)
const adapter = new PrismaBetterSqlite3({
  url: dbPath
});

// 4. 实例化 PrismaClient 并传入适配器
const prisma = globalThis.prismaSteps || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaSteps = prisma;
}

export default prisma;
