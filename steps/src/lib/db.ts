// 这里的 PrismaClient 必须从 steps 自己生成的目录引入
import { PrismaClient } from '../../generated/client';

declare global {
  var prismaSteps: PrismaClient | undefined;
}

// 这里的逻辑与全局 db.ts 一致，但类型是 steps 专有的
const prisma = globalThis.prismaSteps || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaSteps = prisma;
}

export default prisma;
