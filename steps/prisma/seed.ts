import { PrismaClient } from '../generated/client';
import Chain from '../src/types/Chain';
import Step from '../src/types/Step';

const prisma = new PrismaClient({});

async function main() { }

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
