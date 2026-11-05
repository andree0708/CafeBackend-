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

  console.log('Usuarios demo listos:');
  console.log('  admin@cafeia.com / Admin1234');
  console.log('  productor@cafeia.com / Productor1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
