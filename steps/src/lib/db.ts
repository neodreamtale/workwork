import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global {
  var prismaSteps: PrismaClient | undefined;
}

// 1. 获取数据库绝对路径
// 使用 process.cwd() 配合相对路径通常在 tsx 环境下更稳健
const dbDir = path.resolve(process.cwd(), 'prisma');
const dbPath = path.join(dbDir, 'dev.db');

// 2. 预检：如果目录不存在则创建它
if (!fs.existsSync(dbDir)) {
  console.log(`[DB] 正在创建数据库目录: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[DB] 正在连接数据库: ${dbPath}`);

// 3. 创建 Prisma 适配器 (注意：Prisma 7 的这个 URL 可能需要 file: 前缀，也可能不需要，取决于具体版本实现)
// 我们尝试直接传入路径，如果报错再加 file:
const adapter = new PrismaBetterSqlite3({ 
  url: dbPath 
});

// 4. 实例化 PrismaClient
const prisma = globalThis.prismaSteps || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaSteps = prisma;
}

export default prisma;
