import { PrismaClient } from "@prisma/client"
import bcrypt from "bcrypt"
import { SEED_PASSWORD } from "./constants"
import { seedContent } from "./content"
import { seedEngagement } from "./engagement"
import { seedPayments } from "./payments"
import { seedSiteCms } from "./site-cms"
import { seedStudentData } from "./student-data"
import { seedInstitutionalCourseReviews } from "./institutional-reviews"
import { seedUsers } from "./users"

const prisma = new PrismaClient()

export async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)

  console.log("Seeding users...")
  const users = await seedUsers(prisma, passwordHash)

  console.log("Seeding content...")
  await seedContent(prisma, users)

  console.log("Seeding payments...")
  await seedPayments(prisma, users)

  console.log("Seeding student data...")
  await seedStudentData(prisma, users)

  console.log("Seeding institutional course reviews...")
  await seedInstitutionalCourseReviews(prisma, passwordHash)

  console.log("Seeding engagement...")
  await seedEngagement(prisma, users)

  console.log("Seeding site CMS...")
  await seedSiteCms(prisma)

  console.log("\nSeed completed successfully!\n")
  console.log("Login credentials (password: password123):")
  console.log("  SUPER_ADMIN  → superadmin@phynixeducation.com")
  console.log("  ADMIN        → admin@phynixeducation.com")
  console.log("  INSTRUCTOR   → instructor@phynixeducation.com")
  console.log("  Adnan (PRO)  → adnan@example.com")
  console.log("  Rashed       → rashed@example.com")
  console.log("  Demo student → student@fxprime.test")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
