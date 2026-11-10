/**
 * Seed realista: pobla la base con productores, fincas y lotes
 * representativos de regiones cafeteras colombianas.
 *
 * Uso (dentro del contenedor backend o con DATABASE_URL local):
 *   npm run db:seed:realista
 *
 * Idempotente: usa upserts por email / nombre de finca / código de lote.
 * No usa azar: todos los valores son fijos y deterministas.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PASSWORD = 'Productor1234';

const PRODUCERS = [
  { email: 'maria.rios@cafeia.com', firstName: 'María Fernanda', lastName: 'Ríos', phone: '+57 311 204 8890', document: 'CC-36287415' },
  { email: 'jose.vargas@cafeia.com', firstName: 'José Albeiro', lastName: 'Vargas', phone: '+57 312 555 0134', document: 'CC-12987654' },
  { email: 'ana.herrera@cafeia.com', firstName: 'Ana Lucía', lastName: 'Herrera', phone: '+57 320 441 7782', document: 'CC-34567890' },
  { email: 'pedro.osorio@cafeia.com', firstName: 'Pedro Nel', lastName: 'Osorio', phone: '+57 315 902 3345', document: 'CC-71234567' },
  { email: 'lucia.fernandez@cafeia.com', firstName: 'Lucía', lastName: 'Fernández', phone: '+57 314 778 9901', document: 'CC-30345678' },
];

const FARMS = [
  // productor@cafeia.com (Carlos Gómez) ya existe con Finca El Silencio.
  { producerEmail: 'productor@cafeia.com', name: 'Finca La Cascada', location: 'Vereda La Mina', municipality: 'Jardín', department: 'Antioquia', hectares: 3.2, altitude: 1900 },
  { producerEmail: 'maria.rios@cafeia.com', name: 'Finca El Mirador', location: 'Vereda El Tablón', municipality: 'San Agustín', department: 'Huila', hectares: 5.0, altitude: 1780 },
  { producerEmail: 'jose.vargas@cafeia.com', name: 'Finca Buenos Aires', location: 'Vereda San Ignacio', municipality: 'Buesaco', department: 'Nariño', hectares: 2.8, altitude: 2050 },
  { producerEmail: 'ana.herrera@cafeia.com', name: 'Finca Los Naranjos', location: 'Vereda La Topa', municipality: 'Inzá', department: 'Cauca', hectares: 4.1, altitude: 1920 },
  { producerEmail: 'pedro.osorio@cafeia.com', name: 'Finca El Paraíso', location: 'Vereda El Rubí', municipality: 'Planadas', department: 'Tolima', hectares: 6.3, altitude: 1620 },
  { producerEmail: 'lucia.fernandez@cafeia.com', name: 'Finca Villa Rosa', location: 'Vereda La Floresta', municipality: 'Chinchiná', department: 'Caldas', hectares: 7.5, altitude: 1420 },
];

// code, farmName, variety, method, weightKg, harvestDate, variables, evalTotal, notes
const BATCHES = [
  ['CAS-2026-001', 'Finca La Cascada', 'caturra', 'washed', 280, '2026-04-20',
    { avgTemperature: 19.5, avgRainfall: 1900, avgHumidity: 79, soilPH: 6.0, soilOrganicMatter: 4.5, soilNitrogen: 2.2, fertilizationFrequency: '3 veces/año', pestControlType: 'integrated', irrigationType: 'rainfed', dryingMethod: 'raised_bed', dryingDays: 14, storageMoisture: 10.8, fermentationHours: 30, soilType: 'volcanic' },
    84.2, 'Taza limpia, acidez cítrica brillante.'],
  ['CAS-2026-002', 'Finca La Cascada', 'castillo', 'honey', 190, '2026-05-28',
    { avgTemperature: 19.8, avgRainfall: 1850, avgHumidity: 80, soilPH: 5.9, soilOrganicMatter: 4.8, soilNitrogen: 2.4, fertilizationFrequency: '3 veces/año', pestControlType: 'organic', irrigationType: 'rainfed', dryingMethod: 'raised_bed', dryingDays: 16, storageMoisture: 11.0, fermentationHours: 24, soilType: 'volcanic' },
    85.1, 'Dulzor a panela, cuerpo medio-alto.'],
  ['MIR-2026-001', 'Finca El Mirador', 'geisha', 'washed', 150, '2026-05-10',
    { avgTemperature: 20.1, avgRainfall: 1750, avgHumidity: 77, soilPH: 6.2, soilOrganicMatter: 5.1, soilNitrogen: 2.0, fertilizationFrequency: '4 veces/año', pestControlType: 'organic', irrigationType: 'drip', dryingMethod: 'greenhouse', dryingDays: 18, storageMoisture: 10.5, fermentationHours: 36, soilType: 'volcanic' },
    88.4, 'Floral, jazmín y bergamota. Lote de concurso.'],
  ['MIR-2026-002', 'Finca El Mirador', 'caturra', 'honey', 320, '2026-06-02',
    { avgTemperature: 20.3, avgRainfall: 1780, avgHumidity: 78, soilPH: 6.1, soilOrganicMatter: 4.9, soilNitrogen: 2.3, fertilizationFrequency: '4 veces/año', pestControlType: 'integrated', irrigationType: 'drip', dryingMethod: 'raised_bed', dryingDays: 15, storageMoisture: 10.9, fermentationHours: 28, soilType: 'loam' },
    84.9, 'Frutos rojos, final prolongado.'],
  ['MIR-2025-003', 'Finca El Mirador', 'castillo', 'washed', 410, '2025-11-18',
    { avgTemperature: 20.5, avgRainfall: 1950, avgHumidity: 81, soilPH: 6.0, soilOrganicMatter: 4.4, soilNitrogen: 2.5, fertilizationFrequency: '3 veces/año', pestControlType: 'integrated', irrigationType: 'rainfed', dryingMethod: 'sun', dryingDays: 12, storageMoisture: 11.4, fermentationHours: 20, soilType: 'loam' },
    82.6, 'Cosecha principal 2025, perfil clásico Huila.'],
  ['BUE-2026-001', 'Finca Buenos Aires', 'caturra', 'washed', 240, '2026-04-05',
    { avgTemperature: 17.2, avgRainfall: 1650, avgHumidity: 76, soilPH: 5.8, soilOrganicMatter: 5.4, soilNitrogen: 1.9, fertilizationFrequency: '2 veces/año', pestControlType: 'organic', irrigationType: 'rainfed', dryingMethod: 'greenhouse', dryingDays: 20, storageMoisture: 10.4, fermentationHours: 40, soilType: 'volcanic' },
    86.3, 'Gran altura, acidez vibrante y dulzor alto.'],
  ['BUE-2025-002', 'Finca Buenos Aires', 'bourbon', 'natural', 175, '2025-12-12',
    { avgTemperature: 17.5, avgRainfall: 1600, avgHumidity: 75, soilPH: 5.7, soilOrganicMatter: 5.6, soilNitrogen: 1.8, fertilizationFrequency: '2 veces/año', pestControlType: 'organic', irrigationType: 'rainfed', dryingMethod: 'sun', dryingDays: 22, storageMoisture: 11.1, fermentationHours: 72, soilType: 'volcanic' },
    87.1, 'Natural de altura, frutos negros y cacao.'],
  ['NAR-2026-001', 'Finca Los Naranjos', 'colombia', 'washed', 350, '2026-05-22',
    { avgTemperature: 19.2, avgRainfall: 2100, avgHumidity: 82, soilPH: 6.3, soilOrganicMatter: 4.1, soilNitrogen: 2.6, fertilizationFrequency: '3 veces/año', pestControlType: 'chemical', irrigationType: 'rainfed', dryingMethod: 'mechanical', dryingDays: 8, storageMoisture: 11.6, fermentationHours: 18, soilType: 'clay' },
    83.7, 'Cosecha mitaca, secado mecánico por lluvias.'],
  ['NAR-2026-002', 'Finca Los Naranjos', 'castillo', 'honey', 210, '2026-06-10',
    { avgTemperature: 19.0, avgRainfall: 2050, avgHumidity: 81, soilPH: 6.2, soilOrganicMatter: 4.3, soilNitrogen: 2.4, fertilizationFrequency: '3 veces/año', pestControlType: 'integrated', irrigationType: 'rainfed', dryingMethod: 'raised_bed', dryingDays: 16, storageMoisture: 10.7, fermentationHours: 26, soilType: 'clay' },
    84.5, 'Honey rojo, panela y manzana.'],
  ['PAR-2026-001', 'Finca El Paraíso', 'castillo', 'natural', 390, '2026-03-15',
    { avgTemperature: 21.5, avgRainfall: 1700, avgHumidity: 74, soilPH: 6.4, soilOrganicMatter: 3.8, soilNitrogen: 2.8, fertilizationFrequency: '4 veces/año', pestControlType: 'chemical', irrigationType: 'sprinkler', dryingMethod: 'sun', dryingDays: 14, storageMoisture: 11.8, fermentationHours: 60, soilType: 'sandy' },
    81.9, 'Natural de clima cálido, cuerpo alto.'],
  ['PAR-2025-002', 'Finca El Paraíso', 'colombia', 'washed', 440, '2025-10-30',
    { avgTemperature: 21.8, avgRainfall: 1800, avgHumidity: 76, soilPH: 6.3, soilOrganicMatter: 3.9, soilNitrogen: 2.7, fertilizationFrequency: '4 veces/año', pestControlType: 'integrated', irrigationType: 'sprinkler', dryingMethod: 'sun', dryingDays: 11, storageMoisture: 11.5, fermentationHours: 16, soilType: 'loam' },
    82.8, 'Volumen principal 2025 para mercado local.'],
  ['ROS-2026-001', 'Finca Villa Rosa', 'castillo', 'washed', 480, '2026-04-28',
    { avgTemperature: 22.8, avgRainfall: 1500, avgHumidity: 71, soilPH: 6.5, soilOrganicMatter: 3.4, soilNitrogen: 3.0, fertilizationFrequency: '5 veces/año', pestControlType: 'chemical', irrigationType: 'drip', dryingMethod: 'mechanical', dryingDays: 7, storageMoisture: 12.0, fermentationHours: 14, soilType: 'clay' },
    80.4, 'Zona baja Eje Cafetero, perfil comercial sólido.'],
  ['ROS-2025-002', 'Finca Villa Rosa', 'caturra', 'honey', 300, '2025-11-25',
    { avgTemperature: 22.5, avgRainfall: 1550, avgHumidity: 72, soilPH: 6.4, soilOrganicMatter: 3.6, soilNitrogen: 2.9, fertilizationFrequency: '5 veces/año', pestControlType: 'integrated', irrigationType: 'drip', dryingMethod: 'raised_bed', dryingDays: 13, storageMoisture: 11.2, fermentationHours: 22, soilType: 'loam' },
    81.6, 'Honey de fin de cosecha 2025.'],
];

const ATTR_OFFSETS = {
  fragranceScore: 0.1, flavorScore: 0.2, aftertasteScore: 0.0,
  acidityScore: 0.1, bodyScore: -0.2, balanceScore: 0.0,
  uniformityScore: 0.3, cleanCupScore: 0.4, sweetnessScore: 0.1,
};

function buildEvaluation(total) {
  const attrs = {};
  let sum = 0;
  for (const [key, off] of Object.entries(ATTR_OFFSETS)) {
    const base = Math.round(((total - 0.5) / 10 + off) * 10) / 10;
    attrs[key] = base;
    sum += base;
  }
  attrs.overallScore = Math.round((total - sum) * 10) / 10;
  return { ...attrs, totalScore: total };
}

async function upsertProducer(p) {
  const hashed = await bcrypt.hash(PASSWORD, 12);
  const existing = await prisma.user.findUnique({ where: { email: p.email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hashed, role: 'PRODUCER' } });
    return existing;
  }
  return prisma.user.create({
    data: {
      email: p.email, password: hashed, role: 'PRODUCER',
      producer: { create: { firstName: p.firstName, lastName: p.lastName, phone: p.phone, document: p.document } },
    },
  });
}

async function main() {
  for (const p of PRODUCERS) await upsertProducer(p);

  const producerByEmail = {};
  for (const email of [...PRODUCERS.map((p) => p.email), 'productor@cafeia.com']) {
    const user = await prisma.user.findUnique({ where: { email }, include: { producer: true } });
    if (user?.producer) producerByEmail[email] = user.producer;
  }

  for (const f of FARMS) {
    const producer = producerByEmail[f.producerEmail];
    if (!producer) throw new Error(`Productor no encontrado: ${f.producerEmail}`);
    let farm = await prisma.farm.findFirst({ where: { producerId: producer.id, name: f.name } });
    if (!farm) {
      farm = await prisma.farm.create({
        data: {
          name: f.name, location: f.location, municipality: f.municipality,
          department: f.department, hectares: f.hectares, altitude: f.altitude,
          producerId: producer.id,
        },
      });
      console.log(`Finca creada: ${f.name} (${f.municipality}, ${f.department})`);
    }
  }

  for (const [code, farmName, variety, method, weight, harvest, vars, total, notes] of BATCHES) {
    const farm = await prisma.farm.findFirst({ where: { name: farmName } });
    if (!farm) throw new Error(`Finca no encontrada: ${farmName}`);
    const batch = await prisma.batch.upsert({
      where: { code },
      update: {},
      create: { code, harvestDate: new Date(harvest), processingMethod: method, variety, weight, notes, farmId: farm.id },
    });
    await prisma.productionVariables.upsert({ where: { batchId: batch.id }, update: {}, create: { batchId: batch.id, ...vars } });
    const evaluation = buildEvaluation(total);
    await prisma.coffeeEvaluation.upsert({
      where: { batchId: batch.id },
      update: {},
      create: {
        batchId: batch.id, ...evaluation,
        defects: total >= 86 ? 0 : total >= 83 ? 1 : 2,
        evaluatorName: 'Panel CaféIA', evaluationDate: new Date(harvest),
        notes,
      },
    });
    console.log(`Lote listo: ${code} (${farmName}, cata ${total})`);
  }

  console.log(`\nSeed realista completo: ${PRODUCERS.length + 1} productores, ${FARMS.length + 1} fincas, ${BATCHES.length + 1} lotes.`);
  console.log(`Clave de productores: ${PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
