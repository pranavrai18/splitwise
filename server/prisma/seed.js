const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'aisha@example.com' },
      update: {},
      create: { email: 'aisha@example.com', name: 'Aisha', passwordHash }
    }),
    prisma.user.upsert({
      where: { email: 'rohan@example.com' },
      update: {},
      create: { email: 'rohan@example.com', name: 'Rohan', passwordHash }
    }),
    prisma.user.upsert({
      where: { email: 'priya@example.com' },
      update: {},
      create: { email: 'priya@example.com', name: 'Priya', passwordHash }
    }),
    prisma.user.upsert({
      where: { email: 'meera@example.com' },
      update: {},
      create: { email: 'meera@example.com', name: 'Meera', passwordHash }
    }),
    prisma.user.upsert({
      where: { email: 'dev@example.com' },
      update: {},
      create: { email: 'dev@example.com', name: 'Dev', passwordHash }
    }),
    prisma.user.upsert({
      where: { email: 'sam@example.com' },
      update: {},
      create: { email: 'sam@example.com', name: 'Sam', passwordHash }
    }),
  ]);

  const [aisha, rohan, priya, meera, dev, sam] = users;
  console.log(`✅ Created ${users.length} users`);

  // Create group
  const group = await prisma.group.upsert({
    where: { id: 'flatmates-group-001' },
    update: {},
    create: {
      id: 'flatmates-group-001',
      name: 'Flatmates',
      baseCurrency: 'INR',
      createdById: aisha.id
    }
  });
  console.log('✅ Created group: Flatmates');

  // Create memberships with timelines
  const membershipData = [
    { userId: aisha.id, groupId: group.id, role: 'admin', joinDate: new Date('2026-01-01') },
    { userId: rohan.id, groupId: group.id, role: 'member', joinDate: new Date('2026-01-01') },
    { userId: priya.id, groupId: group.id, role: 'member', joinDate: new Date('2026-01-01') },
    { userId: meera.id, groupId: group.id, role: 'member', joinDate: new Date('2026-01-01'), leaveDate: new Date('2026-03-31') },
    { userId: dev.id, groupId: group.id, role: 'member', joinDate: new Date('2026-01-01') },
    { userId: sam.id, groupId: group.id, role: 'member', joinDate: new Date('2026-04-08') },
  ];

  for (const data of membershipData) {
    await prisma.membership.upsert({
      where: {
        userId_groupId_joinDate: {
          userId: data.userId,
          groupId: data.groupId,
          joinDate: data.joinDate
        }
      },
      update: { leaveDate: data.leaveDate || null },
      create: data
    });
  }
  console.log('✅ Created memberships with timelines');
  console.log('   - Meera: leaves 31 March 2026');
  console.log('   - Sam: joins 8 April 2026');

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Login credentials (all users):');
  console.log('   Password: password123');
  console.log('   Emails: aisha@example.com, rohan@example.com, priya@example.com, meera@example.com, dev@example.com, sam@example.com');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
