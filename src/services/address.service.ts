import type { SavedAddressItem } from "@fxprime/types"
import { prisma } from "../lib/prisma"

function mapAddress(row: {
  id: string
  label: string
  name: string
  phone: string
  address: string
  city: string
  postalCode: string | null
  isDefault: boolean
}): SavedAddressItem {
  return {
    id: row.id,
    label: row.label,
    name: row.name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    postalCode: row.postalCode,
    isDefault: row.isDefault,
  }
}

export async function listSavedAddresses(studentId: string): Promise<SavedAddressItem[]> {
  const addresses = await prisma.savedAddress.findMany({
    where: { studentId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })
  return addresses.map(mapAddress)
}

export async function createSavedAddress(
  studentId: string,
  data: {
    label?: string
    name: string
    phone: string
    address: string
    city: string
    postalCode?: string
    isDefault?: boolean
  }
): Promise<SavedAddressItem> {
  if (data.isDefault) {
    await prisma.savedAddress.updateMany({
      where: { studentId },
      data: { isDefault: false },
    })
  }

  const count = await prisma.savedAddress.count({ where: { studentId } })
  const address = await prisma.savedAddress.create({
    data: {
      studentId,
      label: data.label?.trim() || "Home",
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      postalCode: data.postalCode?.trim() || null,
      isDefault: data.isDefault ?? count === 0,
    },
  })

  return mapAddress(address)
}

export async function updateSavedAddress(
  studentId: string,
  addressId: string,
  data: Partial<{
    label: string
    name: string
    phone: string
    address: string
    city: string
    postalCode: string | null
    isDefault: boolean
  }>
): Promise<SavedAddressItem> {
  const existing = await prisma.savedAddress.findFirst({
    where: { id: addressId, studentId },
  })
  if (!existing) {
    throw Object.assign(new Error("Address not found"), { code: "NOT_FOUND" })
  }

  if (data.isDefault) {
    await prisma.savedAddress.updateMany({
      where: { studentId },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.savedAddress.update({
    where: { id: addressId },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  })

  return mapAddress(updated)
}

export async function deleteSavedAddress(
  studentId: string,
  addressId: string
): Promise<void> {
  const existing = await prisma.savedAddress.findFirst({
    where: { id: addressId, studentId },
  })
  if (!existing) {
    throw Object.assign(new Error("Address not found"), { code: "NOT_FOUND" })
  }

  await prisma.savedAddress.delete({ where: { id: addressId } })

  if (existing.isDefault) {
    const next = await prisma.savedAddress.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    })
    if (next) {
      await prisma.savedAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      })
    }
  }
}
