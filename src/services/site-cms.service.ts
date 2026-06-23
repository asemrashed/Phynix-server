import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import type {
  AdminConsultationTypeDetail,
  AdminHomepageSectionDetail,
  AdminSitePageDetail,
  AdminSitePageListItem,
  ConsultationPageContent,
  ContactFaqItem,
  ContactPageContent,
  FooterContent,
  FooterSocialLink,
  FooterSocialPlatform,
  HomepageSectionItem,
  OfficeAddress,
  PublicConsultationTypeConfig,
  PublicHomepageContent,
  PublicHomepageSection,
  PublicSitePage,
  PublicSiteSettings,
  SiteCtaLink,
} from "@fxprime/types"
import { consultationTypeToId } from "@fxprime/types"

const SETTINGS_ID = "default"

/** Landing page section copy is static in frontend code — not editable via admin CMS. */
function assertHomepageSectionEditable(_key: string) {
  const err = new Error(
    "Landing page section copy is managed in code and cannot be edited from the admin panel"
  ) as Error & {
    code?: string
  }
  err.code = "FORBIDDEN"
  throw err
}

const DEFAULT_CONTACT_PAGE: ContactPageContent = {
  eyebrow: "Contact",
  title: "Get in touch",
  description:
    "Questions about courses, payments, or consultations? Our team supports students in Bangladesh and worldwide.",
  formTitle: "Send us a message",
  formSubtitle: "Fill out the form and we'll get back to you within 24–48 hours.",
}

const DEFAULT_FOOTER_TAGLINE =
  "Premium Forex education platform for traders in Bangladesh and worldwide. Learn professional trading with live classes, mentor support, and verified certificates."

const DEFAULT_FOOTER: FooterContent = {
  brandName: "FX Prime Academy",
  brandTagline: DEFAULT_FOOTER_TAGLINE,
  quickLinksTitle: "Quick Links",
  companyLinksTitle: "Company",
  contactTitle: "Contact",
  socialTitle: "Connect With Us",
  quickLinks: [
    { href: "/courses", label: "All Courses" },
    { href: "/courses?free=true", label: "Free Courses" },
    { href: "/live", label: "Live Sessions" },
    { href: "/blog", label: "Blog" },
  ],
  companyLinks: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact Us" },
    { href: "/refund-policy", label: "Refund Policy" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
  bottomLinks: [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/cookies", label: "Cookies" },
  ],
  socialLinks: [
    { platform: "youtube", href: "https://www.youtube.com" },
  ],
  copyrightText: "FX Prime Academy. All rights reserved.",
}

const FOOTER_SOCIAL_PLATFORMS = new Set<FooterSocialPlatform>([
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "twitter",
])

const DEFAULT_CONSULTATION_PAGE: ConsultationPageContent = {
  title: "Consultation Services",
  description:
    "Book a private 1-on-1 session with our expert mentors. Choose your consultation type and pick a time that works for you.",
}

function isEmptyJson(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true
  return Object.keys(value).length === 0
}

function parseContactPage(value: unknown): ContactPageContent {
  const obj = value as Partial<ContactPageContent>
  return {
    eyebrow: obj?.eyebrow ?? DEFAULT_CONTACT_PAGE.eyebrow,
    title: obj?.title ?? DEFAULT_CONTACT_PAGE.title,
    description: obj?.description ?? DEFAULT_CONTACT_PAGE.description,
    formTitle: obj?.formTitle ?? DEFAULT_CONTACT_PAGE.formTitle,
    formSubtitle: obj?.formSubtitle ?? DEFAULT_CONTACT_PAGE.formSubtitle,
  }
}

function parseConsultationPage(value: unknown): ConsultationPageContent {
  const obj = value as Partial<ConsultationPageContent>
  return {
    title: obj?.title ?? DEFAULT_CONSULTATION_PAGE.title,
    description: obj?.description ?? DEFAULT_CONSULTATION_PAGE.description,
  }
}

function parseOfficeAddress(value: unknown): OfficeAddress {
  const obj = value as OfficeAddress
  return {
    line1: obj?.line1 ?? "128 City Road",
    line2: obj?.line2 ?? "London, EC1V 2NX",
  }
}

function parseContactFaq(value: unknown): ContactFaqItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is ContactFaqItem =>
      typeof item?.question === "string" && typeof item?.answer === "string"
  )
}

function parseCtaList(value: unknown): SiteCtaLink[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is SiteCtaLink =>
      typeof item?.label === "string" &&
      item.label.trim().length > 0 &&
      typeof item?.href === "string" &&
      item.href.trim().length > 0
  )
}

function parseSocialLinks(value: unknown): FooterSocialLink[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FooterSocialLink => {
    if (!item || typeof item !== "object") return false
    const platform = (item as FooterSocialLink).platform
    const href = (item as FooterSocialLink).href
    return FOOTER_SOCIAL_PLATFORMS.has(platform) && typeof href === "string" && href.trim().length > 0
  })
}

function parseFooter(value: unknown, legacyTagline?: string | null): FooterContent {
  const tagline = legacyTagline?.trim() || DEFAULT_FOOTER_TAGLINE
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_FOOTER, brandTagline: tagline }
  }

  const obj = value as Partial<FooterContent>
  const quickLinks = parseCtaList(obj.quickLinks)
  const companyLinks = parseCtaList(obj.companyLinks)
  const bottomLinks = parseCtaList(obj.bottomLinks)
  const socialLinks = parseSocialLinks(obj.socialLinks)

  return {
    brandName: obj.brandName?.trim() || DEFAULT_FOOTER.brandName,
    brandTagline: obj.brandTagline?.trim() || tagline,
    quickLinksTitle: obj.quickLinksTitle?.trim() || DEFAULT_FOOTER.quickLinksTitle,
    companyLinksTitle: obj.companyLinksTitle?.trim() || DEFAULT_FOOTER.companyLinksTitle,
    contactTitle: obj.contactTitle?.trim() || DEFAULT_FOOTER.contactTitle,
    socialTitle: obj.socialTitle?.trim() || DEFAULT_FOOTER.socialTitle,
    quickLinks: quickLinks.length ? quickLinks : DEFAULT_FOOTER.quickLinks,
    companyLinks: companyLinks.length ? companyLinks : DEFAULT_FOOTER.companyLinks,
    bottomLinks: bottomLinks.length ? bottomLinks : DEFAULT_FOOTER.bottomLinks,
    socialLinks: socialLinks.length ? socialLinks : DEFAULT_FOOTER.socialLinks,
    copyrightText: obj.copyrightText?.trim() || DEFAULT_FOOTER.copyrightText,
  }
}

function parseCta(value: unknown): SiteCtaLink | null {
  if (!value || typeof value !== "object") return null
  const obj = value as SiteCtaLink
  if (typeof obj.label !== "string" || typeof obj.href !== "string") return null
  return obj
}

function parseItems(value: unknown): HomepageSectionItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is HomepageSectionItem =>
      typeof item?.title === "string" && typeof item?.description === "string"
  )
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function mapHomepageSection(row: {
  key: string
  eyebrow: string | null
  title: string | null
  description: string | null
  items: unknown
  ctaPrimary: unknown
  ctaSecondary: unknown
  metadata: unknown
}): PublicHomepageSection {
  return {
    key: row.key,
    eyebrow: row.eyebrow,
    title: row.title,
    description: row.description,
    items: parseItems(row.items),
    ctaPrimary: parseCta(row.ctaPrimary),
    ctaSecondary: parseCta(row.ctaSecondary),
    metadata: parseMetadata(row.metadata),
  }
}

function mapSitePage(row: {
  slug: string
  title: string
  description: string | null
  contentHtml: string
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: Date
}): PublicSitePage {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    contentHtml: row.contentHtml,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapConsultationType(row: {
  slug: string
  type: "CAREER" | "STUDY_ABROAD" | "TRADING" | "BUSINESS"
  label: string
  description: string
  specialization: string
  sortOrder: number
}): PublicConsultationTypeConfig {
  return {
    id: consultationTypeToId(row.type),
    type: row.type,
    label: row.label,
    description: row.description,
    specialization: row.specialization,
    sortOrder: row.sortOrder,
  }
}

async function getSettingsRecord() {
  return prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  })
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const settings = await getSettingsRecord()
  return {
    supportEmail: settings.supportEmail,
    officeAddress: parseOfficeAddress(settings.officeAddress),
    officeHours: settings.officeHours,
    whatsappNumber: settings.whatsappNumber,
    contactFaq: parseContactFaq(settings.contactFaq),
    contactPage: parseContactPage(settings.contactPage),
    consultationPage: parseConsultationPage(settings.consultationPage),
    footer: parseFooter(settings.footer, settings.footerTagline),
  }
}

export async function getPublicSitePage(slug: string): Promise<PublicSitePage | null> {
  const page = await prisma.sitePage.findFirst({
    where: { slug, isPublished: true },
  })
  if (!page) return null
  return mapSitePage(page)
}

export async function getPublicHomepage(): Promise<PublicHomepageContent> {
  const rows = await prisma.homepageSection.findMany({
    where: { isPublished: true, key: { not: "ai_coach" } },
    orderBy: { key: "asc" },
  })
  const sections: Record<string, PublicHomepageSection> = {}
  for (const row of rows) {
    sections[row.key] = mapHomepageSection(row)
  }
  return { sections }
}

export async function getPublicConsultationTypes(): Promise<PublicConsultationTypeConfig[]> {
  const rows = await prisma.consultationTypeConfig.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return rows.map(mapConsultationType)
}

export async function getAdminSiteSettings(): Promise<PublicSiteSettings> {
  return getPublicSiteSettings()
}

export async function updateAdminSiteSettings(data: {
  supportEmail: string
  officeAddress: OfficeAddress
  officeHours: string
  whatsappNumber?: string | null
  contactFaq: ContactFaqItem[]
  contactPage?: ContactPageContent
  consultationPage?: ConsultationPageContent
}): Promise<PublicSiteSettings> {
  const existing = await getSettingsRecord()
  await prisma.siteSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      supportEmail: data.supportEmail,
      officeAddress: data.officeAddress as unknown as Prisma.InputJsonValue,
      officeHours: data.officeHours,
      whatsappNumber: data.whatsappNumber ?? null,
      contactFaq: data.contactFaq as unknown as Prisma.InputJsonValue,
      contactPage: (data.contactPage ?? DEFAULT_CONTACT_PAGE) as unknown as Prisma.InputJsonValue,
      consultationPage: (data.consultationPage ??
        DEFAULT_CONSULTATION_PAGE) as unknown as Prisma.InputJsonValue,
      footerTagline: DEFAULT_FOOTER_TAGLINE,
      footer: DEFAULT_FOOTER as unknown as Prisma.InputJsonValue,
    },
    update: {
      supportEmail: data.supportEmail,
      officeAddress: data.officeAddress as unknown as Prisma.InputJsonValue,
      officeHours: data.officeHours,
      whatsappNumber: data.whatsappNumber ?? null,
      contactFaq: data.contactFaq as unknown as Prisma.InputJsonValue,
      ...(data.contactPage
        ? { contactPage: data.contactPage as unknown as Prisma.InputJsonValue }
        : {}),
      ...(data.consultationPage
        ? { consultationPage: data.consultationPage as unknown as Prisma.InputJsonValue }
        : {}),
    },
  })

  if (isEmptyJson(existing.contactPage) && !data.contactPage) {
    await prisma.siteSettings.update({
      where: { id: SETTINGS_ID },
      data: { contactPage: DEFAULT_CONTACT_PAGE as unknown as Prisma.InputJsonValue },
    })
  }
  if (isEmptyJson(existing.consultationPage) && !data.consultationPage) {
    await prisma.siteSettings.update({
      where: { id: SETTINGS_ID },
      data: { consultationPage: DEFAULT_CONSULTATION_PAGE as unknown as Prisma.InputJsonValue },
    })
  }

  return getPublicSiteSettings()
}

export async function updateAdminSiteFooter(data: FooterContent): Promise<PublicSiteSettings> {
  await getSettingsRecord()
  await prisma.siteSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      footer: data as unknown as Prisma.InputJsonValue,
      footerTagline: data.brandTagline,
    },
  })
  return getPublicSiteSettings()
}

export async function listAdminSitePages(): Promise<AdminSitePageListItem[]> {
  const pages = await prisma.sitePage.findMany({ orderBy: { slug: "asc" } })
  return pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    description: page.description,
    isPublished: page.isPublished,
    updatedAt: page.updatedAt.toISOString(),
  }))
}

export async function getAdminSitePage(slug: string): Promise<AdminSitePageDetail> {
  const page = await prisma.sitePage.findUnique({ where: { slug } })
  if (!page) {
    const err = new Error("Page not found") as Error & { code?: string }
    err.code = "NOT_FOUND"
    throw err
  }
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    contentHtml: page.contentHtml,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    isPublished: page.isPublished,
    updatedAt: page.updatedAt.toISOString(),
  }
}

export async function updateAdminSitePage(
  slug: string,
  data: {
    title: string
    description?: string | null
    contentHtml: string
    seoTitle?: string | null
    seoDescription?: string | null
    isPublished?: boolean
  }
): Promise<AdminSitePageDetail> {
  const page = await prisma.sitePage.update({
    where: { slug },
    data: {
      title: data.title,
      description: data.description ?? null,
      contentHtml: data.contentHtml,
      seoTitle: data.seoTitle ?? null,
      seoDescription: data.seoDescription ?? null,
      isPublished: data.isPublished,
    },
  })
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    contentHtml: page.contentHtml,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    isPublished: page.isPublished,
    updatedAt: page.updatedAt.toISOString(),
  }
}

export async function listAdminHomepageSections(): Promise<AdminHomepageSectionDetail[]> {
  return []
}

export async function getAdminHomepageSection(key: string): Promise<AdminHomepageSectionDetail> {
  assertHomepageSectionEditable(key)
  const row = await prisma.homepageSection.findUnique({ where: { key } })
  if (!row) {
    const err = new Error("Homepage section not found") as Error & { code?: string }
    err.code = "NOT_FOUND"
    throw err
  }
  return {
    ...mapHomepageSection(row),
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function updateAdminHomepageSection(
  key: string,
  data: {
    eyebrow?: string | null
    title?: string | null
    description?: string | null
    items?: HomepageSectionItem[]
    ctaPrimary?: SiteCtaLink | null
    ctaSecondary?: SiteCtaLink | null
    metadata?: Record<string, unknown> | null
    isPublished?: boolean
  }
): Promise<AdminHomepageSectionDetail> {
  assertHomepageSectionEditable(key)
  const row = await prisma.homepageSection.update({
    where: { key },
    data: {
      eyebrow: data.eyebrow,
      title: data.title,
      description: data.description,
      items: data.items as Prisma.InputJsonValue | undefined,
      ctaPrimary:
        data.ctaPrimary === undefined
          ? undefined
          : data.ctaPrimary === null
            ? Prisma.JsonNull
            : (data.ctaPrimary as unknown as Prisma.InputJsonValue),
      ctaSecondary:
        data.ctaSecondary === undefined
          ? undefined
          : data.ctaSecondary === null
            ? Prisma.JsonNull
            : (data.ctaSecondary as unknown as Prisma.InputJsonValue),
      metadata:
        data.metadata === undefined
          ? undefined
          : data.metadata === null
            ? Prisma.JsonNull
            : (data.metadata as unknown as Prisma.InputJsonValue),
      isPublished: data.isPublished,
    },
  })
  return {
    ...mapHomepageSection(row),
    isPublished: row.isPublished,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listAdminConsultationTypes(): Promise<AdminConsultationTypeDetail[]> {
  const rows = await prisma.consultationTypeConfig.findMany({ orderBy: { sortOrder: "asc" } })
  return rows.map((row) => ({
    ...mapConsultationType(row),
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function updateAdminConsultationType(
  slug: string,
  data: {
    label: string
    description: string
    specialization: string
    sortOrder?: number
    isActive?: boolean
  }
): Promise<AdminConsultationTypeDetail> {
  const row = await prisma.consultationTypeConfig.update({
    where: { slug },
    data,
  })
  return {
    ...mapConsultationType(row),
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }
}
