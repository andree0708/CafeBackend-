const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function upsertUser({ email, password, role, producer }) {
  const hashed = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashed, role },
    });
    return existing;
  }
  return prisma.user.create({
    data: {
      email,
      password: hashed,
      role,
      ...(producer
        ? {
            producer: {
              create: producer,
            },
          }
        : {}),
    },
  });
}

async function main() {
  await upsertUser({
    email: 'admin@cafeia.com',
    password: 'Admin1234',
    role: 'ADMIN',
  });

  await upsertUser({
    email: 'productor@cafeia.com',
    password: 'Productor1234',
    role: 'PRODUCER',
    producer: {
      firstName: 'Carlos',
      lastName: 'Gómez',
      phone: '+57 300 000 0000',
    },
  });

  await seedDemoLot();

  console.log('Usuarios demo listos:');
  console.log('  admin@cafeia.com / Admin1234');
  console.log('  productor@cafeia.com / Productor1234');
  console.log('Lote demo listo: LOT-DEMO-001 (Finca El Silencio)');
}

async function seedDemoLot() {
  const user = await prisma.user.findUnique({
    where: { email: 'productor@cafeia.com' },
    include: { producer: true },
  });
  if (!user?.producer) return;

  let farm = await prisma.farm.findFirst({
    where: { producerId: user.producer.id, name: 'Finca El Silencio' },
  });
  if (!farm) {
    farm = await prisma.farm.create({
      data: {
        name: 'Finca El Silencio',
        location: 'Vereda La Esperanza',
        municipality: 'Salgar',
        department: 'Antioquia',
        hectares: 4.5,
        altitude: 1850,
        producerId: user.producer.id,
      },
    });
  }

  const batch = await prisma.batch.upsert({
    where: { code: 'LOT-DEMO-001' },
    update: {},
    create: {
      code: 'LOT-DEMO-001',
      harvestDate: new Date('2026-05-15'),
      processingMethod: 'washed',
      variety: 'geisha',
      weight: 320,
      notes: 'Lote demo para probar el flujo completo de análisis y recomendación.',
      farmId: farm.id,
    },
  });

  await prisma.productionVariables.upsert({
    where: { batchId: batch.id },
    update: {},
    create: {
      batchId: batch.id,
      avgTemperature: 20.5,
      avgRainfall: 2100,
      avgHumidity: 78,
      soilPH: 6.1,
      soilOrganicMatter: 4.2,
      soilNitrogen: 2.1,
      fertilizationFrequency: '3 veces/año',
      pestControlType: 'organic',
      irrigationType: 'drip',
      dryingMethod: 'raised_bed',
      dryingDays: 15,
      storageMoisture: 10.5,
      fermentationHours: 36,
      soilType: 'volcanic',
    },
  });

  await prisma.coffeeEvaluation.upsert({
    where: { batchId: batch.id },
    update: {},
    create: {
      batchId: batch.id,
      fragranceScore: 8.5,
      flavorScore: 8.7,
      aftertasteScore: 8.4,
      acidityScore: 8.6,
      bodyScore: 8.3,
      balanceScore: 8.5,
      uniformityScore: 8.8,
      cleanCupScore: 8.9,
      sweetnessScore: 8.6,
      overallScore: 8.5,
      totalScore: 85.8,
      defects: 1,
      evaluatorName: 'Panel CaféIA',
      evaluationDate: new Date('2026-06-01'),
      notes: 'Perfil floral y cítrico, cuerpo sedoso.',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
