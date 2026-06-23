import { Request, Response, NextFunction } from "express"
import { z } from "zod"
import { sendSuccess, sendError } from "../lib/response"
import {
  getAdminPaymentSettings,
  updateAdminPaymentSettings,
} from "../services/payment-gateway.service"
import { paymentGatewaySchema } from "../lib/payment-gateways"

const updateSchema = z.object({
  enabledGateways: z.array(paymentGatewaySchema).min(1),
  defaultGateway: paymentGatewaySchema,
  allowUserChoice: z.boolean(),
})

export async function getPaymentSettings(_req: Request, res: Response) {
  const settings = await getAdminPaymentSettings()
  return sendSuccess(res, settings)
}

export async function updatePaymentSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body)
    const settings = await updateAdminPaymentSettings(data)
    return sendSuccess(res, settings)
  } catch (err) {
    next(err)
  }
}
