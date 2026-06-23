import crypto from "crypto"

const SANDBOX_BASE = "https://sandbox.sslcommerz.com"
const LIVE_BASE = "https://securepay.sslcommerz.com"

function getBaseUrl() {
  return process.env.SSLCOMMERZ_IS_SANDBOX === "false" ? LIVE_BASE : SANDBOX_BASE
}

export function isSSLCommerzConfigured(): boolean {
  return !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD)
}

export function convertToBDT(amount: number, currency: string): number {
  if (currency !== "BDT") {
    throw Object.assign(new Error("Only BDT pricing is supported"), {
      code: "UNSUPPORTED_CURRENCY",
    })
  }
  return Math.round(amount * 100) / 100
}

interface InitSessionParams {
  tranId: string
  totalAmount: number
  currency: string
  productName: string
  cusName: string
  cusEmail: string
  cusPhone: string
}

export async function initSSLCommerzSession(params: InitSessionParams): Promise<string> {
  const storeId = process.env.SSLCOMMERZ_STORE_ID!
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD!
  const apiUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}/api/v1`
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"

  const amount = convertToBDT(params.totalAmount, params.currency)

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePasswd,
    total_amount: String(amount),
    currency: "BDT",
    tran_id: params.tranId,
    success_url: `${apiUrl}/payments/sslcommerz/success`,
    fail_url: `${apiUrl}/payments/sslcommerz/fail`,
    cancel_url: `${apiUrl}/payments/sslcommerz/cancel`,
    ipn_url: `${apiUrl}/payments/sslcommerz/ipn`,
    cus_name: params.cusName,
    cus_email: params.cusEmail,
    cus_phone: params.cusPhone || "01700000000",
    cus_add1: "Bangladesh",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: params.productName.slice(0, 100),
    product_category: "Education",
    product_profile: "general",
  })

  const res = await fetch(`${getBaseUrl()}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  const data = (await res.json()) as {
    status: string
    failedreason?: string
    GatewayPageURL?: string
  }

  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw Object.assign(
      new Error(data.failedreason || "SSLCommerz session init failed"),
      { code: "SSLCOMMERZ_INIT_FAILED" }
    )
  }

  return data.GatewayPageURL
}

export async function validateSSLCommerzPayment(valId: string) {
  const storeId = process.env.SSLCOMMERZ_STORE_ID!
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD!

  const params = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePasswd,
    format: "json",
  })

  const res = await fetch(
    `${getBaseUrl()}/validator/api/validationserverAPI.php?${params.toString()}`
  )

  const data = (await res.json()) as {
    status: string
    tran_id: string
    val_id: string
    amount: string
    currency: string
    card_type?: string
  }

  if (data.status !== "VALID" && data.status !== "VALIDATED") {
    throw Object.assign(new Error("Payment validation failed"), { code: "INVALID_PAYMENT" })
  }

  return data
}

export function verifySSLCommerzIPNSignature(body: Record<string, string>): boolean {
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD
  const storeId = process.env.SSLCOMMERZ_STORE_ID
  if (!storePasswd || !storeId) {
    return process.env.NODE_ENV !== "production"
  }

  const { verify_sign, status, tran_id, amount, currency } = body
  if (!verify_sign || !status || !tran_id || !amount || !currency) {
    return process.env.NODE_ENV !== "production"
  }

  const expected = crypto
    .createHash("md5")
    .update(`${storePasswd}${status}${tran_id}${amount}${currency}${storeId}`)
    .digest("hex")

  return verify_sign === expected
}

export function sslCommerzAmountsMatch(expected: number, actual: number, tolerance = 1): boolean {
  return Math.abs(expected - actual) <= tolerance
}
