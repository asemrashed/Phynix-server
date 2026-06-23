import type { ConsultationType } from "@fxprime/types"
import {
  CONSULTATION_TYPE_LABELS,
  getConsultationConfigByType,
  isConsultationType,
} from "@fxprime/types"

export function assertMentorSupportsConsultation(
  specializations: string[],
  consultationType: ConsultationType
) {
  const required = getConsultationConfigByType(consultationType).specialization
  if (!specializations.includes(required)) {
    throw Object.assign(
      new Error(`Mentor does not offer ${CONSULTATION_TYPE_LABELS[consultationType]}`),
      { code: "CONSULTATION_NOT_SUPPORTED" }
    )
  }
}

export function parseConsultationTypeParam(
  value: unknown
): ConsultationType | undefined {
  if (typeof value !== "string" || !isConsultationType(value)) return undefined
  return value
}
