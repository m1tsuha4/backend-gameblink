import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'superadmin@gameblink.com'; 
  const password = 'SuperSecretPassword123!';
  const name = 'Super Administrator';

  console.log(`Creating superadmin with email: ${email}`);

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
        role: UserRole.SUPERADMIN, // Ensure existing user becomes superadmin
    },
    create: {
      email,
      name,
      password: hashedPassword,
      role: UserRole.SUPERADMIN,
    },
  });

  console.log('Superadmin user created/updated:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
