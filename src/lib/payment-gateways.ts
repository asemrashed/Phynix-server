import { z } from "zod"
import type { PaymentGateway } from "@fxprime/types"

export const PAYMENT_GATEWAY_IDS = ["sslcommerz"] as const satisfies readonly PaymentGateway[]

export const paymentGatewaySchema = z.enum(PAYMENT_GATEWAY_IDS)
