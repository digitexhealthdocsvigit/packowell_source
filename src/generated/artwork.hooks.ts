// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Shogo Technologies, Inc.
/**
 * Artwork Hooks
 *
 * Customize business logic for CRUD operations.
 * This file is safe to edit - it will not be overwritten.
 */

import { denyAll, ARTWORK_ROUTE } from '../lib/api-guard'

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
 * Hooks for Artwork routes
 */
export interface ArtworkHooks {
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
 * Default Artwork hooks (customize as needed)
 */
export const artworkHooks: ArtworkHooks = {
  /**
   * Rows are created only by `POST /api/artwork`, which stores the bytes and
   * records a verdict computed on the server, and read by the gated inbox. The
   * generated CRUD let anyone insert a row — including one whose `storedAs`
   * pointed outside the artwork directory.
   */
  ...denyAll(ARTWORK_ROUTE),
}
