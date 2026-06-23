import "dotenv/config"
import bcrypt from "bcrypt"
import { SEED_PASSWORD } from "../prisma/seed/constants"
import { seedInstitutionalCourseReviews } from "../prisma/seed/institutional-reviews"

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)
  const result = await seedInstitutionalCourseReviews(
    (await import("../src/lib/prisma")).prisma,
    passwordHash
  )

  if (!result) {
    throw new Error("Course not found or has no lessons: institutional-forex-mastery")
  }

  const { course, upserted, stats } = result

  console.log(`Course: ${course.title}`)
  console.log(`Reviews upserted: ${upserted}`)
  console.log(
    `Rating: ${stats.averageRating} (${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"})`
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma")
    await prisma.$disconnect()
  })
