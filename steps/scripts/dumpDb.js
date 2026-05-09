const { PrismaClient } = require('../generated/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '../prisma/dev.db');

(async function(){
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const p = new PrismaClient({ adapter });
  try {
    const steps = await p.step.findMany();
    const chains = await p.chain.findMany();
    console.log('STEPS:', JSON.stringify(steps, null, 2));
    console.log('CHAINS:', JSON.stringify(chains, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
})();
