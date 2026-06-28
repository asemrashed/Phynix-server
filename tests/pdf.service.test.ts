import { describe, expect, test } from "bun:test"
import fs from "fs"
import { generateCertificatePdf, getCertificateFilePath } from "../src/services/pdf.service"

function readPdfText(certCode: string) {
  const filepath = getCertificateFilePath(certCode)
  expect(filepath).not.toBeNull()
  return fs.readFileSync(filepath!)
}

describe("generateCertificatePdf", () => {
  test("renders unicode course titles without using default Helvetica", async () => {
    const certCode = "CERT-TEST-UNICODE-001"
    const courseTitle =
      "ফরেক্স কোর্স (Beginner to Advanced) – সম্পূর্ণ বাংলা টেক্সট গাইড"

    const pdfUrl = await generateCertificatePdf({
      certCode,
      studentName: "Adnan Hossain",
      studentId: "FXP-2026-00001",
      courseTitle,
      issuedAt: new Date("2026-06-11T00:00:00.000Z"),
      instructorName: "Phynix Education",
    })

    expect(pdfUrl).toBe(`/api/v1/certificates/${certCode}/download`)

    const pdfBuffer = readPdfText(certCode)
    expect(pdfBuffer.length).toBeGreaterThan(1000)
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF")

    const pdfText = pdfBuffer.toString("latin1")
    expect(pdfText).toContain("NotoSansBengali-Regular")
    expect(pdfText).toContain("NotoSans-Regular")
    expect(pdfText).toContain("/Count 1")
    expect(pdfText).not.toContain("/Helvetica")

    fs.unlinkSync(getCertificateFilePath(certCode)!)
  })

  test("uses NotoSans for latin-only course titles", async () => {
    const certCode = "CERT-TEST-LATIN-001"
    const courseTitle = "Forex Trading Masterclass (Beginner to Advanced)"

    await generateCertificatePdf({
      certCode,
      studentName: "Jane Doe",
      studentId: "FXP-2026-00002",
      courseTitle,
      issuedAt: new Date("2026-06-11T00:00:00.000Z"),
      instructorName: "Phynix Education",
    })

    const pdfBuffer = readPdfText(certCode)
    const pdfText = pdfBuffer.toString("latin1")
    expect(pdfText).toContain("NotoSans-Regular")
    expect(pdfText).toContain("/Count 1")
    expect(pdfText).not.toContain("/Helvetica")

    fs.unlinkSync(getCertificateFilePath(certCode)!)
  })
})
