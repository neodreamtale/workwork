import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global {
  // 按照你的要求，改名为更直观的 steps_prisma
  var steps_prisma: any;
}

// 1. 获取数据库绝对路径
const dbDir = path.resolve(process.cwd(), 'prisma');
const dbPath = path.join(dbDir, 'dev.db');

// 2. 预检：如果目录不存在则创建它
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 3. 创建 Prisma 适配器
const adapter = new PrismaBetterSqlite3({
  url: dbPath
});

// 4. 实例化 PrismaClient
const prisma = globalThis.steps_prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.steps_prisma = prisma;
}

export default prisma;
