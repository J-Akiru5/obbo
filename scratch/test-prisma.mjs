import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to Prisma...");
  const profilesCount = await prisma.profile.count();
  console.log(`Profiles count: ${profilesCount}`);
  
  const models = [
    'profile', 'product', 'shipment', 'shipmentLedger', 'deliveryReceipt',
    'order', 'orderItem', 'customerBalance', 'purchaseOrder', 'warehouseReport',
    'adminSetting', 'activityLog', 'orderReturn', 'notification'
  ];
  
  console.log("\nTable record counts:");
  for (const model of models) {
    try {
      const count = await prisma[model].count();
      console.log(`- ${model}: ${count}`);
    } catch (e) {
      console.log(`- ${model}: Error querying - ${e.message}`);
    }
  }
}

main().catch(err => {
  console.error("Error running Prisma test:", err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
