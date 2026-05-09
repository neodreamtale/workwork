import { PrismaClient } from '../generated/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// 针对 Prisma 7 的新要求，必须显式传递 adapter
// 使用 process.cwd() 确保在 Next.js 环境下路径正确
const dbPath = path.join(process.cwd(), 'steps/prisma/dev.db');

const prismaClientSingleton = () => {
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    return new PrismaClient({ adapter });
};

declare global {
    var prismaSteps: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaSteps ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaSteps = prisma;
