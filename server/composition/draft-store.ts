/**
 * Persistence for Compose/Decompose drafts.
 *
 * The store is a thin interface over one `public.decomposition_drafts` row per
 * `(user, card)`. It is a separate module from the route so the route's behaviour can be
 * tested against a fake, and so the Prisma client — which opens a pool the moment it is
 * imported — is only ever loaded by a request that needs it.
 *
 * Reading validates the stored payload against the *current* contract. Nothing can write
 * an invalid payload (the route validates first), so a validation failure here means the
 * contract tightened since the draft was written. That is surfaced as an error rather than
 * repaired or dropped: authored work is never silently rewritten.
 */

import { Prisma } from '@prisma/client'
import prisma from '../lib/db.js'
import { type DraftPayload, draftPayloadSchema } from './draft-contract.js'

/** A saved draft row, as the API transports it. */
export type StoredDraft = {
  readonly cardSlug: string
  readonly payload: DraftPayload
  readonly createdAt: string
  readonly updatedAt: string
}

/** Raised when a stored payload no longer satisfies the current draft contract. */
export class StoredDraftError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoredDraftError'
  }
}

/** The three operations the draft route needs. Faked in tests. */
export interface DraftStore {
  find(userId: string, cardSlug: string): Promise<StoredDraft | null>
  upsert(
    userId: string,
    cardSlug: string,
    payload: DraftPayload,
  ): Promise<StoredDraft>
  remove(userId: string, cardSlug: string): Promise<void>
}

/**
 * Validate a payload read back from storage.
 *
 * @param raw The `Json` column value.
 * @returns The payload narrowed to {@link DraftPayload}.
 * @throws {StoredDraftError} When the stored value no longer matches the contract.
 */
export function parseStoredPayload(raw: unknown): DraftPayload {
  const result = draftPayloadSchema.safeParse(raw)
  if (!result.success) {
    throw new StoredDraftError(
      'the stored draft no longer matches the draft contract',
    )
  }
  return result.data
}

/** A Draft store backed by Prisma's `public.decomposition_drafts` table. */
export class PrismaDraftStore implements DraftStore {
  async find(userId: string, cardSlug: string): Promise<StoredDraft | null> {
    const row = await prisma.decompositionDraft.findUnique({
      where: { userId_cardSlug: { userId, cardSlug } },
    })
    if (!row) return null
    return {
      cardSlug: row.cardSlug,
      payload: parseStoredPayload(row.payload),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  async upsert(
    userId: string,
    cardSlug: string,
    payload: DraftPayload,
  ): Promise<StoredDraft> {
    const value = payload as unknown as Prisma.InputJsonValue
    const row = await prisma.decompositionDraft.upsert({
      where: { userId_cardSlug: { userId, cardSlug } },
      create: { userId, cardSlug, payload: value },
      update: { payload: value },
    })
    return {
      cardSlug: row.cardSlug,
      payload: parseStoredPayload(row.payload),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  async remove(userId: string, cardSlug: string): Promise<void> {
    await prisma.decompositionDraft.deleteMany({ where: { userId, cardSlug } })
  }
}
