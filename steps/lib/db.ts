const path = require('path');
// load local .env so DATABASE_URL is available before importing Prisma
try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
}

const { PrismaClient } = require('../generated/client');

declare global {
    // allow any to avoid type conflicts across different TS builds
    var prisma: any
}

// reuse client in dev to avoid exhausting connections
const prisma = globalThis.prisma || new PrismaClient({});

if (process.env.NODE_ENV === 'development') globalThis.prisma = prisma;

export default prisma;
