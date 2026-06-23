export type ConsultationTypeId = "career" | "study-abroad" | "trading" | "business"

export type ConsultationType = "CAREER" | "STUDY_ABROAD" | "TRADING" | "BUSINESS"

export interface ConsultationTypeConfig {
  id: ConsultationTypeId
  type: ConsultationType
  label: string
  description: string
  specialization: string
}

export const CONSULTATION_TYPES: ConsultationTypeConfig[] = [
  {
    id: "career",
    type: "CAREER",
    label: "Career Consultation",
    description: "Finance careers, trading jobs, and professional growth",
    specialization: "Career",
  },
  {
    id: "study-abroad",
    type: "STUDY_ABROAD",
    label: "Study Abroad Guidance",
    description: "University applications and finance programs overseas",
    specialization: "Study Abroad",
  },
  {
    id: "trading",
    type: "TRADING",
    label: "Trading Consultation",
    description: "Strategy review, risk management, live market guidance",
    specialization: "Trading",
  },
  {
    id: "business",
    type: "BUSINESS",
    label: "Business Consultation",
    description: "Prop firm setup, trading business, and scaling",
    specialization: "Business",
  },
]

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  CAREER: "Career Consultation",
  STUDY_ABROAD: "Study Abroad Guidance",
  TRADING: "Trading Consultation",
  BUSINESS: "Business Consultation",
}

export const MENTOR_TRADING_SKILLS = [
  "SMC",
  "ICT",
  "Risk Management",
  "Gold Trading",
] as const

export const MENTOR_CONSULTATION_SPECIALIZATIONS = CONSULTATION_TYPES.map(
  (item) => item.specialization
)

const ID_BY_TYPE = Object.fromEntries(
  CONSULTATION_TYPES.map((item) => [item.type, item.id])
) as Record<ConsultationType, ConsultationTypeId>

const TYPE_BY_ID = Object.fromEntries(
  CONSULTATION_TYPES.map((item) => [item.id, item.type])
) as Record<ConsultationTypeId, ConsultationType>

const CONFIG_BY_ID = Object.fromEntries(
  CONSULTATION_TYPES.map((item) => [item.id, item])
) as Record<ConsultationTypeId, ConsultationTypeConfig>

const CONFIG_BY_TYPE = Object.fromEntries(
  CONSULTATION_TYPES.map((item) => [item.type, item])
) as Record<ConsultationType, ConsultationTypeConfig>

export function isConsultationTypeId(value: string): value is ConsultationTypeId {
  return value in TYPE_BY_ID
}

export function isConsultationType(value: string): value is ConsultationType {
  return value in ID_BY_TYPE
}

export function consultationTypeIdToEnum(id: ConsultationTypeId): ConsultationType {
  return TYPE_BY_ID[id]
}

export function consultationTypeToId(type: ConsultationType): ConsultationTypeId {
  return ID_BY_TYPE[type]
}

export function getConsultationConfigById(id: ConsultationTypeId): ConsultationTypeConfig {
  return CONFIG_BY_ID[id]
}

export function getConsultationConfigByType(type: ConsultationType): ConsultationTypeConfig {
  return CONFIG_BY_TYPE[type]
}

export function getConsultationLabel(type: ConsultationType | null | undefined): string | null {
  if (!type) return null
  return CONSULTATION_TYPE_LABELS[type]
}

export function resolveConsultationTypeId(
  value: string | null | undefined,
  fallback: ConsultationTypeId = "trading"
): ConsultationTypeId {
  if (value && isConsultationTypeId(value)) return value
  return fallback
}
