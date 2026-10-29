// SPDX-License-Identifier: Apache-2.0
/**
 * The SDK generates unauthenticated CRUD for every model (`/api/<model>s`) and
 * mounts it ahead of the custom routes, so no middleware registered later can
 * reach it. The generated `*.hooks.ts` files are editable and are consulted on
 * every operation, which makes them the one place a refusal is guaranteed to
 * survive regeneration.
 *
 * Enquiries and artwork go through their own validated routes; nothing in the
 * application reads the generated collections. Turning them off closes both an
 * unauthenticated read of customer data and an unvalidated write path.
 */
export interface Refused {
  ok: false
  error: { code: string; message: string }
}

export const refuse = (message: string, code = 'direct_access_disabled'): Refused => ({
  ok: false,
  error: { code, message },
})

export const ENQUIRY_ROUTE = 'Enquiries are created and read through /api/enquiries and /api/admin/enquiries.'

export const ARTWORK_ROUTE = 'Artwork is uploaded and read through /api/artwork and the business inbox.'

export const USER_ROUTE = 'Accounts are not managed through the public API.'

export const CONFIG_ROUTE =
  'Market configuration is changed through /api/admin/market with the business passcode.'

/** Denial set for a collection that must not be reachable through generated CRUD. */
export const denyAll = (message: string) => ({
  beforeList: async () => refuse(message),
  beforeGet: async () => refuse(message),
  beforeCreate: async () => refuse(message),
  beforeUpdate: async () => refuse(message),
  beforeDelete: async () => refuse(message),
})

/** Writes are refused, reads stay open (this data is already published). */
export const denyWrites = (message: string) => ({
  beforeCreate: async () => refuse(message),
  beforeUpdate: async () => refuse(message),
  beforeDelete: async () => refuse(message),
})
