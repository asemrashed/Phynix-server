import { z } from "zod"
import type { ConsultationType, ConsultationTypeId } from "./consultation"

export interface OfficeAddress {
  line1: string
  line2: string
}

export interface ContactFaqItem {
  question: string
  answer: string
}

export interface SiteCtaLink {
  label: string
  href: string
}

export type FooterSocialPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "twitter"

export interface FooterSocialLink {
  platform: FooterSocialPlatform
  href: string
}

export interface FooterContent {
  brandName: string
  brandTagline: string
  quickLinksTitle: string
  companyLinksTitle: string
  contactTitle: string
  socialTitle: string
  quickLinks: SiteCtaLink[]
  companyLinks: SiteCtaLink[]
  bottomLinks: SiteCtaLink[]
  socialLinks: FooterSocialLink[]
  copyrightText: string
}

export interface HomepageSectionItem {
  icon?: string
  title: string
  description: string
  type?: string
  href?: string
  statKey?: string
  external?: boolean
}

export interface ContactPageContent {
  eyebrow: string
  title: string
  description: string
  formTitle: string
  formSubtitle: string
}

export interface ConsultationPageContent {
  title: string
  description: string
}

export interface PublicSiteSettings {
  supportEmail: string
  officeAddress: OfficeAddress
  officeHours: string
  whatsappNumber: string | null
  contactFaq: ContactFaqItem[]
  contactPage: ContactPageContent
  consultationPage?: ConsultationPageContent
  footer: FooterContent
}

export interface PublicSitePage {
  slug: string
  title: string
  description: string | null
  contentHtml: string
  seoTitle: string | null
  seoDescription: string | null
  updatedAt: string
}

export interface PublicHomepageSection {
  key: string
  eyebrow: string | null
  title: string | null
  description: string | null
  items: HomepageSectionItem[]
  ctaPrimary: SiteCtaLink | null
  ctaSecondary: SiteCtaLink | null
  metadata: Record<string, unknown> | null
}

export interface PublicHomepageContent {
  sections: Record<string, PublicHomepageSection>
}

export interface PublicConsultationTypeConfig {
  id: ConsultationTypeId
  type: ConsultationType
  label: string
  description: string
  specialization: string
  sortOrder: number
}

export interface AdminSitePageListItem {
  slug: string
  title: string
  description: string | null
  isPublished: boolean
  updatedAt: string
}

export interface AdminSitePageDetail extends AdminSitePageListItem {
  contentHtml: string
  seoTitle: string | null
  seoDescription: string | null
}

export interface AdminHomepageSectionDetail extends PublicHomepageSection {
  isPublished: boolean
  updatedAt: string
}

export interface AdminConsultationTypeDetail extends PublicConsultationTypeConfig {
  isActive: boolean
  updatedAt: string
}

export const officeAddressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().min(1),
})

export const contactFaqItemSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
})

export const contactPageContentSchema = z.object({
  eyebrow: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  formTitle: z.string().trim().min(1),
  formSubtitle: z.string().trim().min(1),
})

export const consultationPageContentSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim(),
})

export const siteCtaSchema = z.object({
  label: z.string().trim().min(1),
  href: z.string().trim().min(1),
})

export const footerSocialPlatformSchema = z.enum([
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "twitter",
])

export const footerSocialLinkSchema = z.object({
  platform: footerSocialPlatformSchema,
  href: z.string().trim().url(),
})

export const footerContentSchema = z.object({
  brandName: z.string().trim().min(1),
  brandTagline: z.string().trim().min(1),
  quickLinksTitle: z.string().trim().min(1),
  companyLinksTitle: z.string().trim().min(1),
  contactTitle: z.string().trim().min(1),
  socialTitle: z.string().trim().min(1),
  quickLinks: z.array(siteCtaSchema),
  companyLinks: z.array(siteCtaSchema),
  bottomLinks: z.array(siteCtaSchema),
  socialLinks: z.array(footerSocialLinkSchema),
  copyrightText: z.string().trim().min(1),
})

export const updateSiteSettingsSchema = z.object({
  supportEmail: z.string().trim().email(),
  officeAddress: officeAddressSchema,
  officeHours: z.string().trim().min(1),
  whatsappNumber: z.string().trim().nullable().optional(),
  contactFaq: z.array(contactFaqItemSchema),
  contactPage: contactPageContentSchema.optional(),
  consultationPage: consultationPageContentSchema.optional(),
})

export const updateSiteFooterSchema = footerContentSchema

export const homepageSectionItemSchema = z.object({
  icon: z.string().trim().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim(),
  type: z.string().trim().optional(),
  href: z.string().trim().optional(),
  statKey: z.string().trim().optional(),
  external: z.boolean().optional(),
})

export const updateSitePageSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  contentHtml: z.string().min(1),
  seoTitle: z.string().trim().nullable().optional(),
  seoDescription: z.string().trim().nullable().optional(),
  isPublished: z.boolean().optional(),
})

export const updateHomepageSectionSchema = z.object({
  eyebrow: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  items: z.array(homepageSectionItemSchema).optional(),
  ctaPrimary: siteCtaSchema.nullable().optional(),
  ctaSecondary: siteCtaSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  isPublished: z.boolean().optional(),
})

export const updateConsultationTypeSchema = z.object({
  label: z.string().trim().min(1),
  description: z.string().trim(),
  specialization: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})
