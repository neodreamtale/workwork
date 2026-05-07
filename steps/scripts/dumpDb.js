const { PrismaClient } = require('../generated/client');
(async function(){
  const p = new PrismaClient();
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
