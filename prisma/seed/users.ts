import type { PrismaClient } from "@prisma/client"
import { SEED_IMAGES } from "./constants"
import { upsertStudentUser } from "./helpers"

export type SeedUsers = Awaited<ReturnType<typeof seedUsers>>

export async function seedUsers(prisma: PrismaClient, passwordHash: string) {
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@fxprimeacademy.com" },
    update: { role: "SUPER_ADMIN", isVerified: true, passwordHash },
    create: {
      email: "superadmin@fxprimeacademy.com",
      passwordHash,
      role: "SUPER_ADMIN",
      isVerified: true,
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fxprimeacademy.com" },
    update: { role: "ADMIN", isVerified: true, passwordHash },
    create: {
      email: "admin@fxprimeacademy.com",
      passwordHash,
      role: "ADMIN",
      isVerified: true,
      instructor: {
        create: {
          displayName: "FX Prime Academy",
          bio: "Professional Forex education platform",
          photoUrl: SEED_IMAGES.instructorPhoto,
        },
      },
    },
    include: { instructor: true },
  })

  if (!adminUser.instructor) {
    await prisma.instructor.create({
      data: {
        userId: adminUser.id,
        displayName: "FX Prime Academy",
        bio: "Professional Forex education platform",
        photoUrl: SEED_IMAGES.instructorPhoto,
      },
    })
  }

  const adminWithInstructor = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@fxprimeacademy.com" },
    include: { instructor: true },
  })

  await prisma.mentor.deleteMany({ where: { userId: adminWithInstructor.id } })

  const instructorUser = await prisma.user.upsert({
    where: { email: "instructor@fxprimeacademy.com" },
    update: { role: "INSTRUCTOR", isVerified: true, passwordHash },
    create: {
      email: "instructor@fxprimeacademy.com",
      passwordHash,
      role: "INSTRUCTOR",
      isVerified: true,
      instructor: {
        create: {
          displayName: "Karim Ahmed",
          title: "Senior Financial Market Analyst",
          bio: "Professional forex educator with 8+ years of teaching experience.",
          photoUrl: SEED_IMAGES.instructorPhoto,
        },
      },
    },
    include: { instructor: true },
  })

  if (!instructorUser.instructor) {
    await prisma.instructor.create({
      data: {
        userId: instructorUser.id,
        displayName: "Karim Ahmed",
        title: "Senior Financial Market Analyst",
        bio: "Professional forex educator with 8+ years of teaching experience.",
        photoUrl: SEED_IMAGES.instructorPhoto,
      },
    })
  }

  const instructorWithProfile = await prisma.user.findUniqueOrThrow({
    where: { email: "instructor@fxprimeacademy.com" },
    include: { instructor: true },
  })

  if (instructorWithProfile.instructor) {
    await prisma.instructor.update({
      where: { id: instructorWithProfile.instructor.id },
      data: { title: "Senior Financial Market Analyst" },
    })
  }

  const supportUser = await upsertStudentUser(prisma, {
    email: "support@fxprimeacademy.com",
    passwordHash,
    role: "STUDENT",
    firstName: "Support",
    lastName: "Team",
    phone: "01600000000",
    avatarUrl: SEED_IMAGES.avatarDemo,
  })

  await upsertStudentUser(prisma, {
    email: "adnan@example.com",
    passwordHash,
    role: "STUDENT",
    firstName: "Adnan",
    lastName: "Hossain",
    phone: "01712345678",
    avatarUrl: SEED_IMAGES.avatarAdnan,
  })

  await upsertStudentUser(prisma, {
    email: "rashed@example.com",
    passwordHash,
    role: "STUDENT",
    firstName: "Rashed",
    lastName: "Islam",
    phone: "01898765432",
    avatarUrl: SEED_IMAGES.avatarRashed,
  })

  await upsertStudentUser(prisma, {
    email: "student@fxprime.test",
    passwordHash,
    role: "STUDENT",
    firstName: "Demo",
    lastName: "Student",
    avatarUrl: SEED_IMAGES.avatarDemo,
  })

  const idAssignments: { email: string; uniqueStudentId: string }[] = [
    { email: "adnan@example.com", uniqueStudentId: "FXP-2026-00001" },
    { email: "rashed@example.com", uniqueStudentId: "FXP-2026-00002" },
    { email: "student@fxprime.test", uniqueStudentId: "FXP-2026-00003" },
    { email: "support@fxprimeacademy.com", uniqueStudentId: "FXP-2026-00005" },
  ]

  for (const { email, uniqueStudentId } of idAssignments) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { student: true },
    })
    if (!user?.student) continue

    await prisma.student.updateMany({
      where: {
        uniqueStudentId,
        NOT: { userId: user.id },
      },
      data: { uniqueStudentId: null },
    })

    await prisma.student.update({
      where: { id: user.student.id },
      data: { uniqueStudentId },
    })
  }

  const adnanFinal = await prisma.user.findUniqueOrThrow({
    where: { email: "adnan@example.com" },
    include: { student: true },
  })
  const rashedFinal = await prisma.user.findUniqueOrThrow({
    where: { email: "rashed@example.com" },
    include: { student: true },
  })
  const demoFinal = await prisma.user.findUniqueOrThrow({
    where: { email: "student@fxprime.test" },
    include: { student: true },
  })
  const supportFinal = await prisma.user.findUniqueOrThrow({
    where: { email: "support@fxprimeacademy.com" },
    include: { student: true },
  })

  await prisma.studentIdCounter.upsert({
    where: { id: "global" },
    update: { count: 5 },
    create: { id: "global", count: 5 },
  })

  return {
    superAdmin,
    adminUser: adminWithInstructor,
    instructorUser: instructorWithProfile,
    supportUser: supportFinal,
    adnan: adnanFinal,
    rashed: rashedFinal,
    demoStudent: demoFinal,
  }
}
