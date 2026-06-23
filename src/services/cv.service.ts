import type { StudentCvDraft, StudentCvResponse, StudentPortfolio } from "@fxprime/types"
import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { getStudentPortfolio } from "./portfolio.service"
import { generateStudentCvPdf } from "./pdf.service"

const DEFAULT_DRAFT = (): StudentCvDraft => ({
  headline: "Forex & Finance Professional",
  summary: "",
  skills: ["Forex Trading", "Risk Management", "Market Analysis"],
  experience: [],
  includeCertificates: true,
  includeCompletedCourses: true,
})

function parseCvDraft(value: unknown): StudentCvDraft | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  return {
    headline: typeof v.headline === "string" ? v.headline : "",
    summary: typeof v.summary === "string" ? v.summary : "",
    skills: Array.isArray(v.skills)
      ? v.skills.filter((s): s is string => typeof s === "string")
      : [],
    experience: Array.isArray(v.experience)
      ? v.experience
          .filter(
            (item): item is StudentCvDraft["experience"][number] =>
              typeof item === "object" &&
              item !== null &&
              "title" in item &&
              "organization" in item &&
              "year" in item
          )
          .map((item) => ({
            title: String(item.title),
            organization: String(item.organization),
            year: String(item.year),
            description:
              typeof item.description === "string" ? item.description : undefined,
          }))
      : [],
    contactEmail: typeof v.contactEmail === "string" ? v.contactEmail : undefined,
    contactPhone: typeof v.contactPhone === "string" ? v.contactPhone : undefined,
    includeCertificates: v.includeCertificates !== false,
    includeCompletedCourses: v.includeCompletedCourses !== false,
  }
}

function buildSuggestedDraft(
  portfolio: StudentPortfolio,
  email: string
): StudentCvDraft {
  const completedLevels = [
    ...new Set(
      portfolio.enrollments
        .filter((e) => e.progress === 100)
        .map((e) => e.course.level)
    ),
  ]

  const skills = [
    "Forex Trading",
    ...completedLevels.map((l) => `${l.charAt(0)}${l.slice(1).toLowerCase()} Level`),
    ...(portfolio.stats.certificates > 0 ? ["Certified Trader"] : []),
  ]

  return {
    ...DEFAULT_DRAFT(),
    skills: [...new Set(skills)],
    contactEmail: email,
    contactPhone: portfolio.profile.phone ?? undefined,
    summary: portfolio.stats.coursesCompleted
      ? `FX Prime Academy student with ${portfolio.stats.coursesCompleted} completed course(s) and ${portfolio.stats.certificates} certificate(s).`
      : "",
  }
}

export async function getStudentCv(studentId: string, email: string): Promise<StudentCvResponse> {
  const [student, portfolio] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    getStudentPortfolio(studentId),
  ])

  if (!student) {
    throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" })
  }

  const saved = parseCvDraft(student.cvProfile)
  const draft = saved ?? buildSuggestedDraft(portfolio, email)

  return { draft, portfolio }
}

export async function saveStudentCv(studentId: string, draft: StudentCvDraft) {
  await prisma.student.update({
    where: { id: studentId },
    data: { cvProfile: draft as unknown as Prisma.InputJsonValue },
  })
  return draft
}

export async function buildStudentCvPdf(studentId: string, email: string, draft?: StudentCvDraft) {
  const { draft: current, portfolio } = await getStudentCv(studentId, email)
  const profile = draft ?? current

  if (draft) {
    await saveStudentCv(studentId, draft)
  }

  const completedCourses = profile.includeCompletedCourses
    ? portfolio.enrollments.filter((e) => e.progress === 100)
    : []

  const certificates = profile.includeCertificates ? portfolio.certificates : []

  return generateStudentCvPdf({
    fullName: `${portfolio.profile.firstName} ${portfolio.profile.lastName}`,
    studentId: portfolio.profile.uniqueStudentId || "—",
    country: portfolio.profile.country,
    email: profile.contactEmail || email,
    phone: profile.contactPhone || portfolio.profile.phone || undefined,
    headline: profile.headline,
    summary: profile.summary,
    skills: profile.skills,
    experience: profile.experience,
    completedCourses: completedCourses.map((e) => ({
      title: e.course.title,
      level: e.course.level,
      completedAt: e.completedAt,
    })),
    certificates: certificates.map((c) => ({
      courseTitle: c.courseTitle,
      certCode: c.certCode,
      issuedAt: c.issuedAt,
    })),
    stats: portfolio.stats,
  })
}
