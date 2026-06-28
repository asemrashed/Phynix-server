import PDFDocument from "pdfkit"
import QRCode from "qrcode"
import fs from "fs"
import path from "path"
import { getCertificateVerifyUrl } from "../lib/site-url"

const CERT_DIR = path.join(process.cwd(), "uploads", "certificates")
const FONTS_DIR = path.join(process.cwd(), "assets", "fonts")
const FONT_REGULAR = path.join(FONTS_DIR, "NotoSans-Regular.ttf")
const FONT_BENGALI = path.join(FONTS_DIR, "NotoSansBengali-Regular.ttf")

function ensureCertificateFonts() {
  for (const fontPath of [FONT_REGULAR, FONT_BENGALI]) {
    if (!fs.existsSync(fontPath)) {
      throw new Error(`Certificate font missing: ${fontPath}`)
    }
  }
}

type CertFont = "NotoSans" | "NotoSansBengali"

function isBengaliChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x0980 && code <= 0x09ff
}

function splitTextByScript(text: string): Array<{ text: string; font: CertFont }> {
  if (!text) return []

  const runs: Array<{ text: string; font: CertFont }> = []
  let currentFont: CertFont | null = null
  let currentText = ""

  for (const char of text) {
    const font: CertFont = isBengaliChar(char) ? "NotoSansBengali" : "NotoSans"
    if (currentFont === null) {
      currentFont = font
      currentText = char
    } else if (font === currentFont) {
      currentText += char
    } else {
      runs.push({ text: currentText, font: currentFont })
      currentFont = font
      currentText = char
    }
  }

  if (currentText && currentFont) {
    runs.push({ text: currentText, font: currentFont })
  }

  return runs
}

function measureRunsWidth(
  doc: PDFKit.PDFDocument,
  runs: Array<{ text: string; font: CertFont }>
): number {
  return runs.reduce((total, run) => {
    doc.font(run.font)
    return total + doc.widthOfString(run.text)
  }, 0)
}

interface MixedScriptTextOptions {
  align?: "left" | "center" | "right" | "justify"
  width?: number
  lineGap?: number
}

function writeMixedScriptText(
  doc: PDFKit.PDFDocument,
  text: string,
  options: MixedScriptTextOptions = {}
) {
  const runs = splitTextByScript(text)
  if (runs.length === 0) return

  if (runs.length === 1) {
    doc.font(runs[0].font).text(runs[0].text, options)
    return
  }

  const width = options.width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right
  const align = options.align ?? "left"
  const y = doc.y
  const left = options.width != null ? doc.x : doc.page.margins.left
  const totalWidth = measureRunsWidth(doc, runs)

  let x: number
  if (align === "center") {
    x = left + (width - totalWidth) / 2
  } else if (align === "right") {
    x = left + width - totalWidth
  } else {
    x = doc.x
  }

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    const isLast = i === runs.length - 1
    doc.font(run.font)

    if (i === 0) {
      doc.text(run.text, x, y, {
        continued: !isLast,
        lineBreak: isLast,
        lineGap: options.lineGap,
      })
    } else {
      doc.text(run.text, {
        continued: !isLast,
        lineBreak: isLast,
        lineGap: options.lineGap,
      })
    }
  }
}

function ensureCertDir() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true })
  }
}

interface CertificatePdfData {
  certCode: string
  studentName: string
  studentId: string
  courseTitle: string
  issuedAt: Date
  instructorName: string
}

const CERT_PLATFORM_NAME = "Phynix Education"
const CERT_GREEN = "#1B4332"
const CERT_NAVY = "#1B2A4A"
const CERT_MUTED = "#9CA3AF"
const CERT_BEIGE = "#F5F0E6"

function drawCertificateBorder(doc: PDFKit.PDFDocument) {
  const { width: w, height: h } = doc.page
  const outer = 26
  const frameW = w - outer * 2
  const frameH = h - outer * 2

  doc.rect(0, 0, w, h).fill(CERT_BEIGE)

  doc.lineWidth(5).strokeColor(CERT_GREEN).rect(outer, outer, frameW, frameH).stroke()

  const dotR = 4
  const corners: Array<[number, number]> = [
    [outer, outer],
    [outer + frameW, outer],
    [outer, outer + frameH],
    [outer + frameW, outer + frameH],
  ]
  for (const [cx, cy] of corners) {
    doc.circle(cx, cy, dotR).fill("#FFFFFF")
    doc.circle(cx, cy, dotR).lineWidth(1).strokeColor(CERT_GREEN).stroke()
  }

  const inset = 12
  const ix = outer + inset
  const iy = outer + inset
  const iw = frameW - inset * 2
  const ih = frameH - inset * 2

  doc.lineWidth(1).strokeColor("#FFFFFF").rect(ix, iy, iw, ih).stroke()
  doc.lineWidth(1.2).strokeColor(CERT_GREEN).rect(ix + 3, iy + 3, iw - 6, ih - 6).stroke()
}

function drawCertificateRule(
  doc: PDFKit.PDFDocument,
  centerX: number,
  y: number,
  ruleWidth: number
) {
  doc
    .moveTo(centerX - ruleWidth / 2, y)
    .lineTo(centerX + ruleWidth / 2, y)
    .lineWidth(0.6)
    .strokeColor(CERT_MUTED)
    .stroke()
}

function drawAwardSeal(doc: PDFKit.PDFDocument, centerX: number, centerY: number, year: number) {
  const radius = 34

  doc.circle(centerX, centerY, radius).lineWidth(1.4).strokeColor(CERT_GREEN).stroke()
  doc
    .circle(centerX, centerY, radius - 6)
    .lineWidth(0.8)
    .dash(3, { space: 2 })
    .strokeColor(CERT_GREEN)
    .stroke()
  doc.undash()

  doc
    .font("NotoSans")
    .fontSize(7)
    .fillColor(CERT_GREEN)
    .text("AWARDED", centerX - 28, centerY - 10, { width: 56, align: "center", lineBreak: false })
  doc
    .fontSize(11)
    .text(String(year), centerX - 28, centerY + 2, { width: 56, align: "center", lineBreak: false })
}

export async function generateCertificatePdf(data: CertificatePdfData): Promise<string> {
  ensureCertDir()
  ensureCertificateFonts()

  const filename = `${data.certCode}.pdf`
  const filepath = path.join(CERT_DIR, filename)
  const issuedLabel = data.issuedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const awardYear = data.issuedAt.getFullYear()

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      autoFirstPage: true,
    })
    const stream = fs.createWriteStream(filepath)

    doc.pipe(stream)
    doc.registerFont("NotoSans", FONT_REGULAR)
    doc.registerFont("NotoSansBengali", FONT_BENGALI)

    drawCertificateBorder(doc)

    const pageW = doc.page.width
    const pageH = doc.page.height
    const centerX = pageW / 2
    const contentLeft = 72
    const contentWidth = pageW - contentLeft * 2

    doc
      .font("NotoSans")
      .fontSize(18)
      .fillColor(CERT_NAVY)
      .text(CERT_PLATFORM_NAME, contentLeft, 40, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      })

    doc
      .fontSize(30)
      .fillColor(CERT_NAVY)
      .text("Certificate of Completion", contentLeft, 92, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      })

    doc
      .fontSize(9)
      .fillColor(CERT_MUTED)
      .text("THIS IS TO CERTIFY THAT", contentLeft, 142, {
        width: contentWidth,
        align: "center",
        characterSpacing: 1.5,
        lineBreak: false,
      })

    drawCertificateRule(doc, centerX, 172, 360)

    doc.x = contentLeft
    doc.y = 180
    doc.fontSize(24).fillColor(CERT_NAVY)
    writeMixedScriptText(doc, data.studentName, {
      align: "center",
      width: contentWidth,
    })

    doc
      .font("NotoSans")
      .fontSize(10)
      .fillColor(CERT_MUTED)
      .text("has successfully completed the course", contentLeft, 232, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      })

    drawCertificateRule(doc, centerX, 268, 280)

    doc.x = contentLeft
    doc.y = 276
    doc.fontSize(18).fillColor(CERT_GREEN)
    writeMixedScriptText(doc, data.courseTitle, {
      align: "center",
      width: contentWidth,
    })

    doc.x = contentLeft
    doc.y = 312
    doc
      .font("NotoSans")
      .fontSize(9)
      .fillColor(CERT_MUTED)
    writeMixedScriptText(doc, `Instructor: ${data.instructorName}`, {
      align: "center",
      width: contentWidth,
    })

    const footerY = pageH - 118
    const sigLineY = footerY + 18
    const sigLineW = 130

    drawCertificateRule(doc, centerX - 150, sigLineY, sigLineW)
    drawCertificateRule(doc, centerX + 150, sigLineY, sigLineW)
    drawAwardSeal(doc, centerX, footerY + 8, awardYear)

    doc
      .font("NotoSans")
      .fontSize(8)
      .fillColor(CERT_NAVY)
      .text(`Certificate ID: ${data.certCode}`, centerX - 230, sigLineY + 10, {
        width: 200,
        lineBreak: false,
      })

    doc
      .font("NotoSans")
      .fontSize(8)
      .fillColor(CERT_NAVY)
      .text(`Issuing Date: ${issuedLabel}`, centerX + 30, sigLineY + 10, {
        width: 200,
        lineBreak: false,
      })

    doc
      .fontSize(8)
      .fillColor(CERT_MUTED)
      .text(`Student ID: ${data.studentId}`, contentLeft, pageH - 42, {
        width: contentWidth,
        align: "center",
        lineBreak: false,
      })

    doc.end()

    stream.on("finish", () => resolve())
    stream.on("error", reject)
  })

  return `/api/v1/certificates/${data.certCode}/download`
}

export function getCertificateFilePath(certCode: string): string | null {
  const filepath = path.join(CERT_DIR, `${certCode}.pdf`)
  return fs.existsSync(filepath) ? filepath : null
}

export async function generateCertificateQrPng(
  certCode: string,
  baseUrl?: string
): Promise<Buffer> {
  const verifyUrl = getCertificateVerifyUrl(certCode, baseUrl)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M",
  })
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "")
  return Buffer.from(qrBase64, "base64")
}

export interface StudentCvPdfData {
  fullName: string
  studentId: string
  country: string
  email: string
  phone?: string
  headline?: string
  summary?: string
  skills: string[]
  experience: Array<{
    title: string
    organization: string
    year: string
    description?: string
  }>
  completedCourses: Array<{ title: string; level: string; completedAt: string | null }>
  certificates: Array<{ courseTitle: string; certCode: string; issuedAt: string }>
  stats: {
    coursesEnrolled: number
    coursesCompleted: number
    certificates: number
    learningHours: number
  }
}

export async function generateStudentCvPdf(data: StudentCvPdfData): Promise<Buffer> {
  ensureCertificateFonts()

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    doc.registerFont("NotoSans", FONT_REGULAR)
    doc.registerFont("NotoSansBengali", FONT_BENGALI)

    doc.on("data", (chunk) => chunks.push(chunk as Buffer))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - 100
    const primary = "#0F766E"

    doc.font("NotoSans").fontSize(9).fillColor(primary).text("FX PRIME ACADEMY", { align: "left" })

    doc.moveDown(0.3)
    doc.fontSize(22).fillColor("#0F172A")
    writeMixedScriptText(doc, data.fullName)

    if (data.headline) {
      doc
        .font("NotoSans")
        .fontSize(12)
        .fillColor("#475569")
        .text(data.headline)
    }

    doc.moveDown(0.5)
    doc.font("NotoSans").fontSize(10).fillColor("#64748B")
    const contactParts = [
      data.email,
      data.phone,
      `ID: ${data.studentId}`,
      data.country,
    ].filter(Boolean)
    doc.text(contactParts.join("  ·  "))

    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor("#E2E8F0").stroke()
    doc.moveDown(0.8)

    const section = (title: string) => {
      doc.font("NotoSans").fontSize(12).fillColor(primary).text(title.toUpperCase())
      doc.moveDown(0.4)
    }

    if (data.summary?.trim()) {
      section("Professional Summary")
      doc.fontSize(10).fillColor("#334155")
      writeMixedScriptText(doc, data.summary, { width: pageWidth, lineGap: 3 })
      doc.moveDown(0.8)
    }

    if (data.skills.length > 0) {
      section("Skills")
      doc.font("NotoSans").fontSize(10).fillColor("#334155").text(data.skills.join("  ·  "), {
        width: pageWidth,
      })
      doc.moveDown(0.8)
    }

    if (data.experience.length > 0) {
      section("Experience")
      for (const exp of data.experience) {
        doc
          .font("NotoSans")
          .fontSize(11)
          .fillColor("#0F172A")
          .text(`${exp.title} — ${exp.organization}`, { continued: false })
        doc.font("NotoSans").fontSize(9).fillColor("#64748B").text(exp.year)
        if (exp.description) {
          doc.fontSize(9).fillColor("#475569")
          writeMixedScriptText(doc, exp.description, { width: pageWidth, lineGap: 2 })
        }
        doc.moveDown(0.5)
      }
      doc.moveDown(0.3)
    }

    if (data.completedCourses.length > 0) {
      section("FX Prime Academy — Completed Courses")
      for (const course of data.completedCourses) {
        const date = course.completedAt
          ? new Date(course.completedAt).toLocaleDateString("en-GB", {
              month: "short",
              year: "numeric",
            })
          : ""
        doc.fontSize(10).fillColor("#334155")
        writeMixedScriptText(
          doc,
          `• ${course.title}${date ? ` (${date})` : ""} — ${course.level}`
        )
      }
      doc.moveDown(0.8)
    }

    if (data.certificates.length > 0) {
      section("Certificates")
      for (const cert of data.certificates) {
        const date = new Date(cert.issuedAt).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        })
        doc.fontSize(10).fillColor("#334155")
        writeMixedScriptText(
          doc,
          `• ${cert.courseTitle} — ${cert.certCode} (${date})`
        )
      }
      doc.moveDown(0.8)
    }

    section("Learning Stats")
    doc
      .font("NotoSans")
      .fontSize(10)
      .fillColor("#334155")
      .text(
        `${data.stats.coursesCompleted} courses completed  ·  ${data.stats.certificates} certificates  ·  ${data.stats.learningHours}h learning time`
      )

    doc.moveDown(2)
    doc
      .font("NotoSans")
      .fontSize(8)
      .fillColor("#94A3B8")
      .text("Generated via FX Prime Academy CV Builder", { align: "center" })

    doc.end()
  })
}
