import type { PaymentGateway } from "@fxprime/types"

export type PaymentType =
  | "COURSE"
  | "DIGITAL_PRODUCT"
  | "PHYSICAL_ORDER"
  | "SUBSCRIPTION"
  | "MENTOR_BOOKING"

export interface CreateGenericPaymentInput {
  studentId: string
  userId: string
  type: PaymentType
  amount: number
  currency: string
  gateway: PaymentGateway
  productName: string
  courseId?: string
  entityId?: string
  metadata?: Record<string, unknown>
  customer: { name: string; email: string; phone?: string }
}
