import "dotenv/config"
import { runStudentIdDataBackfill } from "../src/services/student-id.service"

async function main() {
  const result = await runStudentIdDataBackfill()
  console.log(
    `Student ID backfill complete: cleared ${result.cleared} orphan ID(s), issued ${result.issued} missing ID(s).`
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
