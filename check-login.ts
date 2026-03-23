import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "admin@dash.com" } });
  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log("User found:", user.email);
  console.log("Hash:", user.passwordHash);

  const isValid = await bcrypt.compare("admin123", user.passwordHash);
  console.log("Password 'admin123' valid:", isValid);

  const testHash = await bcrypt.hash("admin123", 12);
  console.log("New hash for comparison:", testHash);
  const recheck = await bcrypt.compare("admin123", testHash);
  console.log("Recheck new hash:", recheck);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
