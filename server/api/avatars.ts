/**
 * Account profile photos: `POST`/`DELETE /api/me/avatar` (session-gated) and
 * the public `GET /api/users/:id/avatar` that serves the stored bytes.
 *
 * The data contract keeps bytes off the user row: a session read selects
 * `user` on every request, so storing an image there would ship ~500 KB with
 * each session fetch. Instead the bytes live in a dedicated `user_avatars`
 * row and `user.image` carries only the short public URL of the route that
 * serves them — the same URL every avatar consumer renders, so the account
 * surfaces and Better Auth's own `image` field can never disagree.
 *
 * Uploads are raw bodies, not multipart: `POST /api/me/avatar` carries the
 * image bytes as the request body with the image's MIME type as
 * `Content-Type`. That keeps the route free of a form-data parser and lets
 * the browser send a `File` directly.
 *
 * The declared `Content-Type` is never trusted on its own: {@link sniffImageType}
 * reads the magic bytes, PNG/JPEG/WebP are the only accepted shapes, and the
 * sniffed type is what gets stored and served. A file whose header disagrees
 * with its claim is rejected with `415`, not sanitised into something else.
 *
 * Reads are public — an avatar is public profile data (the public profile
 * preview shows it) — but writes resolve the session and only ever address
 * the session's own row, so one account can never overwrite another's photo.
 */

import { createHash } from 'node:crypto'
import express, {
  Router,
  type ErrorRequestHandler,
  type Request,
} from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { createOriginGuard } from '../lib/origin.js'

/** The signed-in actor a route trusts. Avatar writes need only an id. */
export type SessionActor = { readonly userId: string }

/** Resolves the current session, or `null` when signed out. Injected in tests. */
export type GetSession = (req: Request) => Promise<SessionActor | null>

/** The only MIME types a stored avatar may carry. Mirrored by the sniffer. */
export const AVATAR_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

/** One accepted avatar MIME type, as narrowed by {@link sniffImageType}. */
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number]

/**
 * The upload ceiling, enforced by the raw body parser (413 on breach).
 * Deliberately small: an avatar renders at 72px, and this keeps a hostile
 * upload from becoming a cheap memory-residency DoS.
 */
export const AVATAR_MAX_BYTES = 512 * 1024

/** A stored avatar as the read paths see it. */
export interface StoredAvatar {
  readonly mimeType: AvatarMimeType
  readonly data: Uint8Array
  /** SHA-256 of the stored bytes; the cache key for the public read. */
  readonly etag: string
}

/**
 * Persistence port for profile photos. Injected in tests; the Prisma-backed
 * default resolves lazily because `lib/db.ts` opens a pool on import.
 */
export interface AvatarStore {
  /** Upsert the owner's avatar (one row per user) and return what was stored. */
  save(
    userId: string,
    mimeType: AvatarMimeType,
    data: Uint8Array,
  ): Promise<StoredAvatar>
  /** Read a user's avatar, or `null` when none is stored. */
  read(userId: string): Promise<StoredAvatar | null>
  /** Remove a user's avatar. Idempotent: removing an absent row is a no-op. */
  remove(userId: string): Promise<void>
  /** Point `user.image` at the avatar URL, or clear it (`null`) on removal. */
  setUserImage(userId: string, image: string | null): Promise<void>
}

/** Collaborators the router needs. All optional; production defaults resolve lazily. */
export interface AvatarsRouterDeps {
  readonly store?: AvatarStore
  readonly getSession?: GetSession
  /** Trusted browser origins for the CSRF origin guard on the write verbs. */
  readonly trustedOrigins?: readonly string[]
}

/**
 * The public URL of a user's avatar, versioned by content hash.
 *
 * The `v` parameter is what makes a re-upload visible immediately: the URL
 * changes, so caches keyed on it fetch fresh bytes, while the unversioned
 * route revalidates through its ETag.
 *
 * @param userId The account the avatar belongs to.
 * @param etag SHA-256 of the stored bytes.
 * @returns The versioned public avatar URL stored in `user.image`.
 */
export function publicAvatarUrl(userId: string, etag: string): string {
  return `/api/users/${encodeURIComponent(userId)}/avatar?v=${etag}`
}

/**
 * Read an image's type from its magic bytes.
 *
 * The only place an upload's type is decided. A declared `Content-Type` may say
 * anything; these signatures cannot be argued with by a crafted file.
 *
 * @param data The uploaded bytes.
 * @returns The sniffed type, or `null` when the bytes are not a PNG/JPEG/WebP.
 * @example
 * ```ts
 * sniffImageType(pngBytes) // 'image/png'
 * sniffImageType(textBytes) // null
 * ```
 */
export function sniffImageType(data: Uint8Array): AvatarMimeType | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return 'image/jpeg'
  }
  // WebP: "RIFF" … "WEBP"
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

/** SHA-256 of some bytes, hex-encoded — the avatar's ETag and cache key. */
function etagOf(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Prisma-backed store. `prisma` is imported lazily inside each method so merely
 * importing this module never opens a database connection.
 */
const prismaAvatarStore: AvatarStore = {
  async save(userId, mimeType, data) {
    const { prisma } = await import('../lib/db.js')
    const etag = etagOf(data)
    await prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, mimeType, data: Buffer.from(data) },
      update: { mimeType, data: Buffer.from(data) },
    })
    return { mimeType, data, etag }
  },

  async read(userId) {
    const { prisma } = await import('../lib/db.js')
    const row = await prisma.userAvatar.findUnique({ where: { userId } })
    if (row === null) return null
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(row.mimeType)) {
      // Rows are written only by this module's sniffer-gated save, so an
      // off-allowlist type is corruption, not a state a client can reach.
      // Report absence rather than serve bytes under a header nobody vouches
      // for; consumers fall back to their designed initials state.
      return null
    }
    // Narrowed by the allowlist check above.
    return {
      mimeType: row.mimeType as AvatarMimeType,
      data: row.data,
      etag: etagOf(row.data),
    }
  },

  async remove(userId) {
    const { prisma } = await import('../lib/db.js')
    await prisma.userAvatar.deleteMany({ where: { userId } })
  },

  async setUserImage(userId, image) {
    const { prisma } = await import('../lib/db.js')
    await prisma.user.update({ where: { id: userId }, data: { image } })
  },
}

/**
 * Build the avatars router.
 *
 * The same router instance is mounted twice — at `/api/me` (the session's
 * own write verbs) and at `/api/users` (the public read) — so each mount
 * scopes narrowly to its own namespace instead of claiming all of `/api`,
 * where a catch-all mount would change how unknown paths under other
 * routers' namespaces answer.
 *
 * @param deps Optional collaborators. Production omits them and the lazily
 *   resolved Prisma store and Better Auth session are used; tests supply
 *   fakes so the routes run without a database or an auth server.
 * @returns A configured `express` router, mounted at `/api/me` and
 *   `/api/users`.
 */
export function createAvatarsRouter(deps: AvatarsRouterDeps = {}): Router {
  let store = deps.store
  let getSession = deps.getSession

  const resolveStore = (): AvatarStore => {
    store ??= prismaAvatarStore
    return store
  }

  const resolveSession = async (): Promise<GetSession> => {
    getSession ??= async (req) => {
      const { auth } = await import('../auth.js')
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
      return session ? { userId: session.user.id } : null
    }
    return getSession
  }

  const router = Router()

  // CSRF: the session cookie rides on the write verbs, so reject requests
  // from an untrusted Origin before any session or database work. GETs pass.
  router.use(createOriginGuard({ trustedOrigins: deps.trustedOrigins }))

  // The public read. An avatar is public profile data, so no session is
  // required; the stored ETag makes revalidation a 304 rather than a re-ship.
  router.get('/:id/avatar', async (req, res) => {
    try {
      const avatar = await resolveStore().read(req.params.id)
      if (avatar === null) {
        res.status(404).json({ error: 'No avatar for this account' })
        return
      }
      const etag = `"${avatar.etag}"`
      res.set('Content-Type', avatar.mimeType)
      res.set('ETag', etag)
      // A versioned URL (the `?v=` `user.image` carries) is immutable: the
      // version is the content hash, so the bytes it names never change. The
      // unversioned URL revalidates on every hit, cheaply, through its ETag.
      res.set(
        'Cache-Control',
        typeof req.query.v === 'string' && req.query.v !== ''
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      )
      if (req.get('if-none-match') === etag) {
        res.status(304).end()
        return
      }
      res.status(200).end(Buffer.from(avatar.data))
    } catch (error) {
      console.error('Error serving avatar:', error)
      res.status(500).json({ error: 'Failed to serve avatar' })
    }
  })

  // The upload. The raw body parser is route-local: it only buffers when the
  // declared type is an accepted image type, enforces the size ceiling, and
  // leaves the sniff to make the type decision.
  router.post(
    '/avatar',
    express.raw({
      type: [...AVATAR_MIME_TYPES],
      limit: AVATAR_MAX_BYTES,
    }),
    async (req, res) => {
      try {
        const actor = await (await resolveSession())(req)
        if (!actor) {
          res.status(401).json({ error: 'Sign in to change your profile photo' })
          return
        }
        // `express.raw` skips bodies whose declared type is not an accepted
        // image type, so anything that is not a Buffer here arrived with the
        // wrong Content-Type.
        if (!Buffer.isBuffer(req.body)) {
          res
            .status(415)
            .json({ error: 'Only PNG, JPEG and WebP images are accepted' })
          return
        }
        const data = new Uint8Array(req.body)
        if (data.length === 0) {
          res.status(400).json({ error: 'The chosen image is empty' })
          return
        }
        const mimeType = sniffImageType(data)
        if (mimeType === null) {
          // The header claimed an image; the bytes disagree. Refuse rather
          // than guess what the file really is.
          res
            .status(415)
            .json({ error: 'Only PNG, JPEG and WebP images are accepted' })
          return
        }
        const stored = await resolveStore().save(actor.userId, mimeType, data)
        const image = publicAvatarUrl(actor.userId, stored.etag)
        await resolveStore().setUserImage(actor.userId, image)
        res.status(200).json({ image })
      } catch (error) {
        console.error('Error storing avatar:', error)
        res.status(500).json({ error: 'Failed to store avatar' })
      }
    },
  )

  // The removal. Also clears `user.image`, so every consumer falls back to
  // its designed initials state rather than a broken image URL.
  router.delete('/avatar', async (req, res) => {
    try {
      const actor = await (await resolveSession())(req)
      if (!actor) {
        res.status(401).json({ error: 'Sign in to change your profile photo' })
        return
      }
      await resolveStore().remove(actor.userId)
      await resolveStore().setUserImage(actor.userId, null)
      res.status(200).json({ image: null })
    } catch (error) {
      console.error('Error removing avatar:', error)
      res.status(500).json({ error: 'Failed to remove avatar' })
    }
  })

  // Translate raw-parser errors (oversize bodies above all) into the JSON
  // envelope every other route answers with, rather than an HTML error page.
  const rawError: ErrorRequestHandler = (err, _req, res, next) => {
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { type?: unknown }).type === 'entity.too.large'
    ) {
      res.status(413).json({ error: 'The image must be 512 KB or smaller' })
      return
    }
    next(err)
  }
  router.use(rawError)

  return router
}

const router = createAvatarsRouter()

export default router
