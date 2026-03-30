import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, passwordHash: true },
  });
  console.log("Users found:", users.length);
  for (const u of users) {
    console.log(`- ${u.email} | role: ${u.role} | hash starts: ${u.passwordHash.substring(0, 20)}...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
