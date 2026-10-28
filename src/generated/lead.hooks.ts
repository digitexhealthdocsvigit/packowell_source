// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Shogo Technologies, Inc.
/**
 * Lead Hooks
 *
 * Customize business logic for CRUD operations.
 * This file is safe to edit - it will not be overwritten.
 */

import { denyAll, ENQUIRY_ROUTE } from '../lib/api-guard'

/**
 * Result from a hook that can modify or reject the operation
 */
export interface HookResult<T = any> {
  ok: boolean
  error?: { code: string; message: string }
  data?: T
}

/**
 * Hook context with Prisma client
 */
export interface HookContext {
  body: any
  params: Record<string, string>
  query: Record<string, string>
  userId?: string
  tunnelAuthenticated: boolean
  prisma: any
}

/**
 * Hooks for Lead routes
 */
export interface LeadHooks {
  /**
   * Called before listing records. Can modify where/include/orderBy.
   * Note: Query parameters (except limit, offset, userId, include, orderBy) are automatically
   * added to the where clause. This hook receives them and can override/extend them.
   */
  beforeList?: (ctx: HookContext) => Promise<HookResult<{ where?: any; include?: any; orderBy?: any }> | void>
  /** Called before getting a single record. Can reject access. */
  beforeGet?: (id: string, ctx: HookContext) => Promise<HookResult | void>
  /** Called before creating a record. Can modify input or reject. */
  beforeCreate?: (input: any, ctx: HookContext) => Promise<HookResult<any> | void>
  /** Called after creating a record. Can perform side effects. */
  afterCreate?: (record: any, ctx: HookContext) => Promise<void>
  /** Called before updating a record. Can modify input or reject. */
  beforeUpdate?: (id: string, input: any, ctx: HookContext) => Promise<HookResult<any> | void>
  /** Called after updating a record. Can perform side effects. */
  afterUpdate?: (record: any, ctx: HookContext) => Promise<void>
  /** Called before deleting a record. Can reject deletion. */
  beforeDelete?: (id: string, ctx: HookContext) => Promise<HookResult | void>
  /** Called after deleting a record. Can perform cleanup. */
  afterDelete?: (id: string, ctx: HookContext) => Promise<void>
}

/**
 * Default Lead hooks (customize as needed)
 */
export const leadHooks: LeadHooks = {
  /**
   * Nothing reaches the generated collection any more.
   *
   * Every enquiry is written by `POST /api/enquiries`, which resolves the
   * destination, validates the postal code and currency, suppresses duplicates
   * and takes the status itself; and every enquiry is read by
   * `GET /api/admin/enquiries`, which requires the business token. The generic
   * CRUD routes bypassed all of that, unauthenticated, so they are refused here.
   */
  ...denyAll(ENQUIRY_ROUTE),
}
