/**
 * ╔═════════════════════════════════════════════════════════════════════╗
 * ║                  Mock API Server  —  v3.0.0                         ║
 * ║          Pure Node.js `http`  •  Zero external dependencies         ║
 * ╠═════════════════════════════════════════════════════════════════════╣
 * ║  CONTROLLERS                                                        ║
 * ║   AUTH         /auth/*                                              ║
 * ║   USER         /user (PATCH/DELETE)                                  ║
 * ║   FOUNDATION   /foundation/*  (business, store, catalog, product, inv)║
 * ║   CART         /cart                                                ║
 * ║   ORDER        /orders  /orders/:id  /orders/:id/cancel             ║
 * ║                /orders/:id/status  (admin)                          ║
 * ║   REVIEW       /reviews  /reviews/:id  /reviews/:id/moderate        ║
 * ║   NOTIFICATION /notifications  /notifications/:id/read              ║
 * ║                /notifications/read-all  /notifications/broadcast    ║
 * ║   UTILITY      /  /health  /cache-clear  /db-snapshot               ║
 * ║   DOCS         /openapi.json   /docs  (Swagger UI)                  ║
 * ╠═════════════════════════════════════════════════════════════════════╣
 * ║  INFRASTRUCTURE                                                     ║
 * ║   • Colored request logger + response-time ms                       ║
 * ║   • Per-IP sliding-window rate limiter                              ║
 * ║   • Token expiry (2h)  +  POST /auth/refresh                        ║
 * ║   • SHA-256 password hashing via built-in crypto                    ║
 * ║   • Schema validator used on every mutating endpoint                ║
 * ║   • Pagination  (?page=1&limit=20)  on all list endpoints           ║
 * ║   • Soft-delete (deletedAt)  +  ?includeDeleted=true  for ADMIN     ║
 * ║   • X-Request-Id on every response                                  ║
 * ║   • Internal event bus  (pushNotification helper)                   ║
 * ╚═════════════════════════════════════════════════════════════════════╝
 *
 *  node server.js
 *
 *  Env vars:
 *    PORT           (default 3000)
 *    TOKEN_TTL_MS   (default 7200000 = 2h)
 *    RATE_LIMIT     (default 60 req/min per IP)
 *    HASH_SALT      (default "mock_salt_change_in_prod")
 */

'use strict'
import http from 'node:http'
import crypto from 'node:crypto'
import { buildOpenAPISpec } from './openapi.js'

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  TOKEN_TTL_MS: Number(process.env.TOKEN_TTL_MS) || 2 * 60 * 60 * 1000,
  RATE_LIMIT: Number(process.env.RATE_LIMIT) || 240,
  RATE_WINDOW_MS: 60_000,
  HASH_SALT: process.env.HASH_SALT || 'mock_salt_change_in_prod',
  VERSION: '3.0.0',
}

// ═══════════════════════════════════════════════════════════════════════════
//  IN-MEMORY DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const DB = {
  users: [], // { id, email, passwordHash, firstname, lastname, role, status, createdAt, updatedAt, deletedAt }
  sessions: {}, // token → { userId, expiresAt, createdAt }
  businesses: [], // { id, name, email, phone, address, createdAt, updatedAt, deletedAt }
  stores: [], // { id, name, businessId, location, createdAt, updatedAt, deletedAt }
  catalogs: [], // { id, name, storeId, createdAt, updatedAt, deletedAt }
  products: [], // { id, name, description, price, catalogId, createdAt, updatedAt, deletedAt }
  inventory: [], // { id, productId, quantity, createdAt, updatedAt }
  carts: [], // { id, userId, items:[{productId,qty,addedAt}], createdAt, updatedAt }
  orders: [], // { id, userId, items, subtotal, status, statusHistory, cancelReason, createdAt, updatedAt }
  reviews: [], // { id, userId, productId, orderId, rating, comment, status, moderationNote, createdAt, updatedAt }
  notifications: [], // { id, userId, type, title, body, read, createdAt }
}

let _seq = 1
const nextId = () => String(_seq++)

// ─── Order status machine ────────────────────────────────────────────────────
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

// ─── Review moderation statuses ──────────────────────────────────────────────
const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

// ═══════════════════════════════════════════════════════════════════════════
//  CRYPTO  (built-in only)
// ═══════════════════════════════════════════════════════════════════════════

const hashPassword = (p) =>
  crypto
    .createHash('sha256')
    .update(CONFIG.HASH_SALT + p)
    .digest('hex')
const makeRequestId = () => crypto.randomBytes(8).toString('hex')
const makeToken = () => crypto.randomBytes(32).toString('hex')

// ═══════════════════════════════════════════════════════════════════════════
//  LOGGER
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
}
const MCL = { GET: C.green, POST: C.blue, PATCH: C.yellow, DELETE: C.red, OPTIONS: C.dim }
const sclr = (s) => (s < 300 ? C.green : s < 400 ? C.cyan : s < 500 ? C.yellow : C.red)

function logReq(method, url, status, ms, reqId) {
  const ts = new Date().toISOString().slice(11, 23)
  console.log(
    `${C.dim}${ts}${C.reset} ` +
      `${MCL[method] || C.white}${C.bold}${method.padEnd(7)}${C.reset} ` +
      `${url.padEnd(50)} ` +
      `${sclr(status)}${status}${C.reset} ` +
      `${C.dim}${ms}ms  [${reqId}]${C.reset}`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════

const _rateMap = new Map()
function isRateLimited(ip) {
  const now = Date.now(),
    cutoff = now - CONFIG.RATE_WINDOW_MS
  const hits = (_rateMap.get(ip) || []).filter((t) => t > cutoff)
  hits.push(now)
  _rateMap.set(ip, hits)
  return hits.length > CONFIG.RATE_LIMIT
}
setInterval(() => {
  const cutoff = Date.now() - CONFIG.RATE_WINDOW_MS
  for (const [ip, hits] of _rateMap) if (hits.every((t) => t <= cutoff)) _rateMap.delete(ip)
}, 5 * 60_000).unref()

// ═══════════════════════════════════════════════════════════════════════════
//  VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

function validate(data, schema) {
  const errors = []
  for (const [field, rules] of Object.entries(schema)) {
    const val = data[field]
    const missing = val === undefined || val === null
    if (rules.required && (missing || val === '')) {
      errors.push(`'${field}' is required`)
      continue
    }
    if (missing) continue
    if (rules.type && typeof val !== rules.type) errors.push(`'${field}' must be a ${rules.type}`)
    if (rules.enum && !rules.enum.map(String).includes(String(val).toUpperCase()))
      errors.push(`'${field}' must be one of: ${rules.enum.join(', ')}`)
    if (rules.minLength !== undefined && String(val).length < rules.minLength)
      errors.push(`'${field}' must be at least ${rules.minLength} characters`)
    if (rules.maxLength !== undefined && String(val).length > rules.maxLength)
      errors.push(`'${field}' must be at most ${rules.maxLength} characters`)
    if (rules.min !== undefined && Number(val) < rules.min)
      errors.push(`'${field}' must be ≥ ${rules.min}`)
    if (rules.max !== undefined && Number(val) > rules.max)
      errors.push(`'${field}' must be ≤ ${rules.max}`)
    if (rules.match && !rules.match.test(String(val)))
      errors.push(`'${field}' has an invalid format`)
  }
  return { valid: errors.length === 0, errors }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAGINATION
// ═══════════════════════════════════════════════════════════════════════════

function paginate(array, query) {
  const page = Math.max(1, parseInt(query.page || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)))
  const total = array.length
  return {
    data: array.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SOFT-DELETE
// ═══════════════════════════════════════════════════════════════════════════

const isAlive = (r) => !r.deletedAt
const softDel = (r) => {
  r.deletedAt = new Date().toISOString()
  return r
}
const liveList = (arr, query) =>
  query && query.includeDeleted === 'true' ? arr : arr.filter(isAlive)

// ═══════════════════════════════════════════════════════════════════════════
//  INTERNAL EVENT BUS  — push notifications on business events
// ═══════════════════════════════════════════════════════════════════════════

function pushNotification(userId, type, title, body) {
  DB.notifications.push({
    id: nextId(),
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  HTTP UTILS
// ═══════════════════════════════════════════════════════════════════════════

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, payload, reqId) {
  const body = JSON.stringify(payload, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Request-Id': reqId || '-',
  })
  res.end(body)
}

function sendRaw(res, status, contentType, body, reqId) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'X-Request-Id': reqId || '-',
  })
  res.end(body)
}

const ok = (res, data, reqId, status = 200) =>
  send(res, status, { success: true, ...(data || {}) }, reqId)
const err = (res, message, reqId, status = 400, extra = {}) =>
  send(res, status, { success: false, error: message, ...extra }, reqId)

// ═══════════════════════════════════════════════════════════════════════════
//  AUTH UTILS
// ═══════════════════════════════════════════════════════════════════════════

function resolveUser(req) {
  const raw = req.headers['authorization'] || ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null
  if (!token) return { user: null, token: null, reason: 'no_token' }
  const session = DB.sessions[token]
  if (!session) return { user: null, token, reason: 'invalid_token' }
  if (Date.now() > session.expiresAt) {
    delete DB.sessions[token]
    return { user: null, token, reason: 'token_expired' }
  }
  const user = DB.users.find((u) => u.id === session.userId && !u.deletedAt)
  return user ? { user, token } : { user: null, token, reason: 'user_not_found' }
}

function requireAuth(res, req, reqId) {
  const { user, reason } = resolveUser(req)
  if (!user)
    err(
      res,
      reason === 'token_expired'
        ? 'Token expired — please log in again'
        : 'Unauthorized — valid Bearer token required',
      reqId,
      401
    )
  return user
}

function requireRole(res, req, role, reqId) {
  const user = requireAuth(res, req, reqId)
  if (!user) return null
  if (user.role !== role) {
    err(res, `Forbidden — requires role: ${role}`, reqId, 403)
    return null
  }
  return user
}

const safeUser = ({ passwordHash: _, ...u }) => u

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const routes = []

function route(method, pattern, handler) {
  routes.push({ method: method.toUpperCase(), pattern, handler })
}

function matchRoute(method, url) {
  const [rawPath, qs] = url.split('?')
  const path = rawPath !== '/' ? rawPath.replace(/\/$/, '') : rawPath
  const query = Object.fromEntries(new URLSearchParams(qs || ''))
  for (const r of routes) {
    if (r.method !== method) continue
    if (typeof r.pattern === 'string') {
      if (r.pattern === path) return { handler: r.handler, params: {}, query }
    } else {
      const m = r.pattern.exec(path)
      if (m) return { handler: r.handler, params: m.groups || {}, query }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// ██████████████████████████  AUTH  ████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════

route('POST', '/auth/register', async (req, res, { reqId }) => {
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    email: { required: true, type: 'string', match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { required: true, type: 'string', minLength: 6, maxLength: 128 },
    firstname: { required: true, type: 'string', minLength: 1, maxLength: 64 },
    lastname: { required: true, type: 'string', minLength: 1, maxLength: 64 },
    role: { type: 'string', enum: ['ADMIN', 'USER'] },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  const email = body.email.toLowerCase().trim()
  if (DB.users.find((u) => u.email === email && !u.deletedAt))
    return err(res, 'Email already registered', reqId, 409)

  const now = new Date().toISOString()
  const user = {
    id: nextId(),
    email,
    passwordHash: hashPassword(body.password),
    firstname: body.firstname.trim(),
    lastname: body.lastname.trim(),
    role: (body.role || 'USER').toUpperCase(),
    status: 'INACTIVE',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  DB.users.push(user)
  ok(
    res,
    { message: 'Registered — account is INACTIVE until approved', user: safeUser(user) },
    reqId,
    201
  )
})

route('POST', '/auth/login', async (req, res, { reqId }) => {
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  const email = body.email.toLowerCase().trim()
  const user = DB.users.find(
    (u) => u.email === email && u.passwordHash === hashPassword(body.password) && !u.deletedAt
  )
  if (!user) return err(res, 'Invalid email or password', reqId, 401)

  const token = makeToken()
  const expiresAt = Date.now() + CONFIG.TOKEN_TTL_MS
  DB.sessions[token] = { userId: user.id, expiresAt, createdAt: new Date().toISOString() }

  pushNotification(user.id, 'AUTH', 'New login', `You logged in from a new session.`)
  ok(
    res,
    {
      message: 'Login successful',
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      user: safeUser(user),
    },
    reqId
  )
})

route('POST', '/auth/logout', async (req, res, { reqId }) => {
  const { user, token } = resolveUser(req)
  if (!user) return err(res, 'Unauthorized', reqId, 401)
  delete DB.sessions[token]
  ok(res, { message: 'Logged out — token invalidated' }, reqId)
})

route('GET', '/auth/me', async (req, res, { reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  ok(res, { user: safeUser(user) }, reqId)
})

route('POST', '/auth/refresh', async (req, res, { reqId }) => {
  const { user, token, reason } = resolveUser(req)
  if (!user)
    return err(
      res,
      reason === 'token_expired' ? 'Token expired — please log in again' : 'Unauthorized',
      reqId,
      401
    )
  DB.sessions[token].expiresAt = Date.now() + CONFIG.TOKEN_TTL_MS
  ok(
    res,
    { message: 'Token refreshed', expiresAt: new Date(DB.sessions[token].expiresAt).toISOString() },
    reqId
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ██████████████████████████  USER  ████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════

route('PATCH', '/user', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    firstname: { type: 'string', minLength: 1, maxLength: 64, example: 'Jane' },
    lastname: { type: 'string', minLength: 1, maxLength: 64, example: 'Smith' },
    password: { type: 'string', minLength: 6, maxLength: 128 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  if (body.firstname) user.firstname = body.firstname.trim()
  if (body.lastname) user.lastname = body.lastname.trim()
  if (body.password) user.passwordHash = hashPassword(body.password)
  user.updatedAt = new Date().toISOString()
  ok(res, { message: 'Profile updated', user: safeUser(user) }, reqId)
})

route('DELETE', '/user', async (req, res, { reqId }) => {
  const { user } = resolveUser(req)
  if (!user || user.role !== 'USER') return err(res, 'Forbidden', reqId, 403)
  softDel(user)
  user.updatedAt = new Date().toISOString()
  for (const [t, s] of Object.entries(DB.sessions)) if (s.userId === user.id) delete DB.sessions[t]
  ok(res, { message: 'Account deactivated' }, reqId)
})

// ═══════════════════════════════════════════════════════════════════════════
// █████████████████████  FOUNDATION  ██████████═════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

// ── BUSINESS ────────────────────────────────────────────────────────────────

route('GET', '/foundation/business', async (req, res, { query, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const { data, meta } = paginate(liveList(DB.businesses, query), query)
  ok(res, { businesses: data, meta }, reqId)
})
route('POST', '/foundation/business', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    name: { required: true, type: 'string', minLength: 1, maxLength: 120 },
    email: { type: 'string', match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    phone: { type: 'string', maxLength: 20 },
    address: { type: 'string', maxLength: 255 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  const now = new Date().toISOString()
  const biz = {
    id: nextId(),
    name: body.name.trim(),
    email: body.email || null,
    phone: body.phone || null,
    address: body.address || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  DB.businesses.push(biz)
  ok(res, { business: biz }, reqId, 201)
})
route('GET', /^\/foundation\/business\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const biz = DB.businesses.find((b) => b.id === params.id && !b.deletedAt)
  if (!biz) return err(res, 'Business not found', reqId, 404)
  ok(res, { business: biz }, reqId)
})
route('PATCH', /^\/foundation\/business\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const biz = DB.businesses.find((b) => b.id === params.id && !b.deletedAt)
  if (!biz) return err(res, 'Business not found', reqId, 404)
  const body = await parseBody(req)
  for (const k of ['name', 'email', 'phone', 'address']) if (body[k] !== undefined) biz[k] = body[k]
  biz.updatedAt = new Date().toISOString()
  ok(res, { business: biz }, reqId)
})
route('DELETE', /^\/foundation\/business\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const biz = DB.businesses.find((b) => b.id === params.id && !b.deletedAt)
  if (!biz) return err(res, 'Business not found', reqId, 404)
  softDel(biz)
  ok(res, { message: 'Business deleted', business: biz }, reqId)
})

// ── STORE ────────────────────────────────────────────────────────────────────

route('GET', '/foundation/store', async (req, res, { query, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const { data, meta } = paginate(liveList(DB.stores, query), query)
  ok(res, { stores: data, meta }, reqId)
})
route('POST', '/foundation/store', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    name: { required: true, type: 'string', minLength: 1, maxLength: 120 },
    businessId: { type: 'string' },
    location: { type: 'string', maxLength: 255 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  if (body.businessId && !DB.businesses.find((b) => b.id === body.businessId && !b.deletedAt))
    return err(res, `Business '${body.businessId}' not found`, reqId, 404)
  const now = new Date().toISOString()
  const store = {
    id: nextId(),
    name: body.name.trim(),
    businessId: body.businessId || null,
    location: body.location || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  DB.stores.push(store)
  ok(res, { store }, reqId, 201)
})
route('GET', /^\/foundation\/store\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const store = DB.stores.find((s) => s.id === params.id && !s.deletedAt)
  if (!store) return err(res, 'Store not found', reqId, 404)
  ok(res, { store }, reqId)
})
route('PATCH', /^\/foundation\/store\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const store = DB.stores.find((s) => s.id === params.id && !s.deletedAt)
  if (!store) return err(res, 'Store not found', reqId, 404)
  const body = await parseBody(req)
  for (const k of ['name', 'location', 'businessId']) if (body[k] !== undefined) store[k] = body[k]
  store.updatedAt = new Date().toISOString()
  ok(res, { store }, reqId)
})
route('DELETE', /^\/foundation\/store\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const store = DB.stores.find((s) => s.id === params.id && !s.deletedAt)
  if (!store) return err(res, 'Store not found', reqId, 404)
  softDel(store)
  ok(res, { message: 'Store deleted', store }, reqId)
})

// ── CATALOG ──────────────────────────────────────────────────────────────────

route('GET', '/foundation/catalog', async (req, res, { query, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const { data, meta } = paginate(liveList(DB.catalogs, query), query)
  ok(res, { catalogs: data, meta }, reqId)
})
route('POST', '/foundation/catalog', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    name: { required: true, type: 'string', minLength: 1, maxLength: 120 },
    storeId: { required: true, type: 'string' },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  if (!DB.stores.find((s) => s.id === body.storeId && !s.deletedAt))
    return err(res, `Store '${body.storeId}' not found`, reqId, 404)
  const now = new Date().toISOString()
  const cat = {
    id: nextId(),
    name: body.name.trim(),
    storeId: body.storeId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  DB.catalogs.push(cat)
  ok(res, { catalog: cat }, reqId, 201)
})
route('GET', /^\/foundation\/catalog\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const cat = DB.catalogs.find((c) => c.id === params.id && !c.deletedAt)
  if (!cat) return err(res, 'Catalog not found', reqId, 404)
  ok(res, { catalog: cat }, reqId)
})
route('PATCH', /^\/foundation\/catalog\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const cat = DB.catalogs.find((c) => c.id === params.id && !c.deletedAt)
  if (!cat) return err(res, 'Catalog not found', reqId, 404)
  const body = await parseBody(req)
  if (body.storeId && !DB.stores.find((s) => s.id === body.storeId && !s.deletedAt))
    return err(res, `Store '${body.storeId}' not found`, reqId, 404)
  for (const k of ['name', 'storeId']) if (body[k] !== undefined) cat[k] = body[k]
  cat.updatedAt = new Date().toISOString()
  ok(res, { catalog: cat }, reqId)
})
route('DELETE', /^\/foundation\/catalog\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const cat = DB.catalogs.find((c) => c.id === params.id && !c.deletedAt)
  if (!cat) return err(res, 'Catalog not found', reqId, 404)
  softDel(cat)
  ok(res, { message: 'Catalog deleted', catalog: cat }, reqId)
})

// ── PRODUCT ──────────────────────────────────────────────────────────────────

route('GET', '/foundation/product', async (req, res, { query, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const { data, meta } = paginate(liveList(DB.products, query), query)
  ok(res, { products: data, meta }, reqId)
})
route('POST', '/foundation/product', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    name: { required: true, type: 'string', minLength: 1, maxLength: 120 },
    catalogId: { required: true, type: 'string' },
    price: { required: true, type: 'number', min: 0 },
    description: { type: 'string', maxLength: 500 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  if (!DB.catalogs.find((c) => c.id === body.catalogId && !c.deletedAt))
    return err(res, `Catalog '${body.catalogId}' not found`, reqId, 404)
  const now = new Date().toISOString()
  const prod = {
    id: nextId(),
    name: body.name.trim(),
    description: body.description || null,
    price: body.price,
    catalogId: body.catalogId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  DB.products.push(prod)
  ok(res, { product: prod }, reqId, 201)
})
route('GET', /^\/foundation\/product\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const prod = DB.products.find((p) => p.id === params.id && !p.deletedAt)
  if (!prod) return err(res, 'Product not found', reqId, 404)
  ok(res, { product: prod }, reqId)
})
route('PATCH', /^\/foundation\/product\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const prod = DB.products.find((p) => p.id === params.id && !p.deletedAt)
  if (!prod) return err(res, 'Product not found', reqId, 404)
  const body = await parseBody(req)
  if (body.catalogId && !DB.catalogs.find((c) => c.id === body.catalogId && !c.deletedAt))
    return err(res, `Catalog '${body.catalogId}' not found`, reqId, 404)
  for (const k of ['name', 'description', 'price', 'catalogId'])
    if (body[k] !== undefined) prod[k] = body[k]
  prod.updatedAt = new Date().toISOString()
  ok(res, { product: prod }, reqId)
})
route('DELETE', /^\/foundation\/product\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const prod = DB.products.find((p) => p.id === params.id && !p.deletedAt)
  if (!prod) return err(res, 'Product not found', reqId, 404)
  softDel(prod)
  ok(res, { message: 'Product deleted', product: prod }, reqId)
})

// ── INVENTORY ────────────────────────────────────────────────────────────────

route('GET', '/foundation/inventory', async (req, res, { query, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const { data, meta } = paginate(DB.inventory, query)
  ok(res, { inventory: data, meta }, reqId)
})
route('POST', '/foundation/inventory', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    productId: { required: true, type: 'string' },
    quantity: { required: true, type: 'number', min: 0 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  if (!DB.products.find((p) => p.id === body.productId && !p.deletedAt))
    return err(res, `Product '${body.productId}' not found`, reqId, 404)
  const now = new Date().toISOString()
  let inv = DB.inventory.find((i) => i.productId === body.productId)
  if (inv) {
    inv.quantity = body.quantity
    inv.updatedAt = now
  } else {
    inv = {
      id: nextId(),
      productId: body.productId,
      quantity: body.quantity,
      createdAt: now,
      updatedAt: now,
    }
    DB.inventory.push(inv)
  }
  ok(res, { inventory: inv }, reqId)
})
route(
  'GET',
  /^\/foundation\/inventory\/(?<productId>[^/]+)$/,
  async (req, res, { params, reqId }) => {
    if (!requireRole(res, req, 'ADMIN', reqId)) return
    const inv = DB.inventory.find((i) => i.productId === params.productId)
    if (!inv) return err(res, 'Inventory not found', reqId, 404)
    ok(res, { inventory: inv }, reqId)
  }
)

// ═══════════════════════════════════════════════════════════════════════════
// ██████████████████████████  CART  ████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════

function getUserCart(userId) {
  let cart = DB.carts.find((c) => c.userId === userId)
  if (!cart) {
    const now = new Date().toISOString()
    cart = { id: nextId(), userId, items: [], createdAt: now, updatedAt: now }
    DB.carts.push(cart)
  }
  return cart
}

function enrichCart(cart) {
  const items = cart.items.map((i) => ({
    ...i,
    product: DB.products.find((p) => p.id === i.productId && !p.deletedAt) || null,
  }))
  const subtotal = items.reduce((sum, i) => sum + (i.product?.price || 0) * i.qty, 0)
  return { ...cart, items, subtotal }
}

route('GET', '/cart', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  ok(res, { cart: enrichCart(getUserCart(user.id)) }, reqId)
})
route('POST', '/cart', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    productId: { required: true, type: 'string' },
    qty: { type: 'number', min: 1 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  const product = DB.products.find((p) => p.id === body.productId && !p.deletedAt)
  if (!product) return err(res, 'Product not found', reqId, 404)

  // Verify product is in a catalog that belongs to a store
  const catalog = DB.catalogs.find((c) => c.id === product.catalogId && !c.deletedAt)
  if (!catalog || !DB.stores.find((s) => s.id === catalog.storeId && !s.deletedAt)) {
    return err(res, 'Product is not associated with any active store catalog', reqId, 409)
  }

  // Check inventory
  const inv = DB.inventory.find((i) => i.productId === body.productId)
  const requestedQty = Math.max(1, Math.round(body.qty || 1))
  if (!inv || inv.quantity < requestedQty) {
    return err(res, `Insufficient inventory. Available: ${inv?.quantity || 0}`, reqId, 409)
  }

  const cart = getUserCart(user.id)
  const ex = cart.items.find((i) => i.productId === body.productId)
  if (ex) {
    if (inv.quantity < ex.qty + requestedQty) {
      return err(res, `Insufficient inventory to add more. Available: ${inv.quantity}`, reqId, 409)
    }
    ex.qty += requestedQty
  } else {
    cart.items.push({
      productId: body.productId,
      qty: requestedQty,
      addedAt: new Date().toISOString(),
    })
  }
  cart.updatedAt = new Date().toISOString()
  ok(res, { cart: enrichCart(cart) }, reqId)
})
route('PATCH', '/cart', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    productId: { required: true, type: 'string' },
    qty: { required: true, type: 'number', min: 0 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  const cart = getUserCart(user.id)
  const item = cart.items.find((i) => i.productId === body.productId)
  if (!item) return err(res, 'Item not in cart', reqId, 404)

  if (body.qty > 0) {
    const inv = DB.inventory.find((i) => i.productId === body.productId)
    if (!inv || inv.quantity < body.qty) {
      return err(res, `Insufficient inventory. Available: ${inv?.quantity || 0}`, reqId, 409)
    }
    item.qty = Math.round(body.qty)
  } else {
    cart.items = cart.items.filter((i) => i.productId !== body.productId)
  }

  cart.updatedAt = new Date().toISOString()
  ok(res, { cart: enrichCart(cart) }, reqId)
})
route('DELETE', '/cart', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const body = await parseBody(req)
  const cart = getUserCart(user.id)
  if (body.productId) {
    if (!cart.items.find((i) => i.productId === body.productId))
      return err(res, 'Item not in cart', reqId, 404)
    cart.items = cart.items.filter((i) => i.productId !== body.productId)
    ok(res, { message: 'Item removed', cart: enrichCart(cart) }, reqId)
  } else {
    cart.items = []
    ok(res, { message: 'Cart cleared', cart: enrichCart(cart) }, reqId)
  }
  cart.updatedAt = new Date().toISOString()
})

// ═══════════════════════════════════════════════════════════════════════════
// █████████████████████████  ORDER  ████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════
//
//  POST   /orders             — USER: checkout current cart → new order
//  GET    /orders             — USER: own orders  |  ADMIN: all orders
//  GET    /orders/:id         — USER: own order   |  ADMIN: any order
//  POST   /orders/:id/cancel  — USER: cancel own order (if allowed)
//  PATCH  /orders/:id/status  — ADMIN: advance order through status machine
//

function buildOrderItems(cartItems) {
  return cartItems.map((i) => {
    const svc = DB.services.find((s) => s.id === i.serviceId) || {}
    return {
      serviceId: i.serviceId,
      serviceName: svc.name || 'Unknown',
      price: svc.price || 0,
      qty: i.qty,
      lineTotal: (svc.price || 0) * i.qty,
    }
  })
}

// POST /orders  — checkout cart
route('POST', '/orders', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return

  const cart = getUserCart(user.id)
  if (!cart.items.length)
    return err(res, 'Cart is empty — add items before checking out', reqId, 400)

  const body = await parseBody(req)
  const items = buildOrderItems(cart.items)
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const now = new Date().toISOString()

  const order = {
    id: nextId(),
    userId: user.id,
    shippingAddress: body.shippingAddress || null,
    note: body.note || null,
    items,
    subtotal,
    status: 'PENDING',
    statusHistory: [{ status: 'PENDING', at: now, by: user.id }],
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
  }
  DB.orders.push(order)

  // Clear cart after checkout
  cart.items = []
  cart.updatedAt = now

  pushNotification(
    user.id,
    'ORDER',
    'Order placed',
    `Your order #${order.id} has been placed and is PENDING.`
  )

  ok(res, { message: 'Order placed', order }, reqId, 201)
})

// GET /orders  — USER gets own; ADMIN gets all (with optional ?status= filter)
route('GET', '/orders', async (req, res, { query, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return

  let list = user.role === 'ADMIN' ? DB.orders : DB.orders.filter((o) => o.userId === user.id)

  if (query.status) {
    const s = query.status.toUpperCase()
    list = list.filter((o) => o.status === s)
  }
  if (query.userId && user.role === 'ADMIN') list = list.filter((o) => o.userId === query.userId)

  const { data, meta } = paginate([...list].reverse(), query) // newest first
  ok(res, { orders: data, meta }, reqId)
})

// GET /orders/:id
route('GET', /^\/orders\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  const order = DB.orders.find((o) => o.id === params.id)
  if (!order) return err(res, 'Order not found', reqId, 404)
  if (user.role !== 'ADMIN' && order.userId !== user.id) return err(res, 'Forbidden', reqId, 403)
  ok(res, { order }, reqId)
})

// POST /orders/:id/cancel  — USER cancels own order
route('POST', /^\/orders\/(?<id>[^/]+)\/cancel$/, async (req, res, { params, reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return

  const order = DB.orders.find((o) => o.id === params.id && o.userId === user.id)
  if (!order) return err(res, 'Order not found', reqId, 404)

  if (!ORDER_TRANSITIONS[order.status]?.includes('CANCELLED'))
    return err(res, `Cannot cancel an order in status: ${order.status}`, reqId, 409)

  const body = await parseBody(req)
  const now = new Date().toISOString()
  order.status = 'CANCELLED'
  order.cancelReason = body.reason || 'Cancelled by user'
  order.statusHistory.push({
    status: 'CANCELLED',
    at: now,
    by: user.id,
    reason: order.cancelReason,
  })
  order.updatedAt = now

  pushNotification(user.id, 'ORDER', 'Order cancelled', `Order #${order.id} has been cancelled.`)

  ok(res, { message: 'Order cancelled', order }, reqId)
})

// PATCH /orders/:id/status  — ADMIN advances status
route('PATCH', /^\/orders\/(?<id>[^/]+)\/status$/, async (req, res, { params, reqId }) => {
  const admin = requireRole(res, req, 'ADMIN', reqId)
  if (!admin) return

  const order = DB.orders.find((o) => o.id === params.id)
  if (!order) return err(res, 'Order not found', reqId, 404)

  const body = await parseBody(req)
  const target = (body.status || '').toUpperCase()
  if (!ORDER_STATUSES.includes(target))
    return err(res, `Invalid status. Valid: ${ORDER_STATUSES.join(', ')}`, reqId, 400)
  if (!ORDER_TRANSITIONS[order.status]?.includes(target))
    return err(
      res,
      `Cannot transition from ${order.status} → ${target}. Allowed: ${ORDER_TRANSITIONS[order.status].join(', ') || 'none'}`,
      reqId,
      409
    )

  const now = new Date().toISOString()
  order.status = target
  order.statusHistory.push({ status: target, at: now, by: admin.id, note: body.note || null })
  order.updatedAt = now

  pushNotification(
    order.userId,
    'ORDER',
    'Order update',
    `Your order #${order.id} is now ${target}.`
  )

  ok(res, { message: `Order status updated to ${target}`, order }, reqId)
})

// ═══════════════════════════════════════════════════════════════════════════
// █████████████████████████  REVIEW  ███████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════
//
//  POST   /reviews               — USER: submit a review for a product
//  GET    /reviews               — PUBLIC: list APPROVED reviews
//                                  ADMIN: all reviews + ?status= filter
//  GET    /reviews/:id           — any
//  PATCH  /reviews/:id           — USER: edit own PENDING review
//  DELETE /reviews/:id           — USER: delete own  |  ADMIN: delete any
//  PATCH  /reviews/:id/moderate  — ADMIN: approve or reject
//
//  Rules:
//   - One review per user per product
//   - User must have a DELIVERED order containing the product
//   - New reviews start as PENDING (require admin approval)
//

route('POST', '/reviews', async (req, res, { reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const body = await parseBody(req)

  const { valid, errors } = validate(body, {
    productId: { required: true, type: 'string' },
    orderId: { required: true, type: 'string' },
    rating: { required: true, type: 'number', min: 1, max: 5 },
    comment: { type: 'string', minLength: 3, maxLength: 1000 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  // Product must exist
  if (!DB.products.find((p) => p.id === body.productId && !p.deletedAt))
    return err(res, 'Product not found', reqId, 404)

  // Order must belong to user, be DELIVERED, and contain the product
  const order = DB.orders.find((o) => o.id === body.orderId && o.userId === user.id)
  if (!order) return err(res, 'Order not found', reqId, 404)
  if (order.status !== 'DELIVERED')
    return err(res, 'You can only review products from DELIVERED orders', reqId, 409)
  if (!order.items.find((i) => i.productId === body.productId))
    return err(res, 'Product was not part of that order', reqId, 409)

  // One review per user per product
  if (DB.reviews.find((r) => r.userId === user.id && r.productId === body.productId))
    return err(res, 'You have already reviewed this product', reqId, 409)

  const now = new Date().toISOString()
  const review = {
    id: nextId(),
    userId: user.id,
    productId: body.productId,
    orderId: body.orderId,
    rating: Math.round(body.rating),
    comment: body.comment || null,
    status: 'PENDING',
    moderationNote: null,
    createdAt: now,
    updatedAt: now,
  }
  DB.reviews.push(review)
  ok(res, { message: 'Review submitted — pending moderation', review }, reqId, 201)
})

route('GET', '/reviews', async (req, res, { query, reqId }) => {
  const { user } = resolveUser(req) // optional auth
  let list = DB.reviews

  if (user?.role === 'ADMIN') {
    if (query.status) list = list.filter((r) => r.status === query.status.toUpperCase())
    if (query.productId) list = list.filter((r) => r.productId === query.productId)
  } else {
    // Public only sees approved reviews
    list = list.filter((r) => r.status === 'APPROVED')
    if (query.productId) list = list.filter((r) => r.productId === query.productId)
  }

  // Attach product name for context
  const enriched = list.map((r) => ({
    ...r,
    productName: DB.products.find((p) => p.id === r.productId)?.name || null,
  }))

  const { data, meta } = paginate(enriched, query)
  ok(res, { reviews: data, meta }, reqId)
})

route('GET', /^\/reviews\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  const review = DB.reviews.find((r) => r.id === params.id)
  if (!review) return err(res, 'Review not found', reqId, 404)
  const { user } = resolveUser(req)
  if (review.status !== 'APPROVED' && user?.role !== 'ADMIN' && user?.id !== review.userId)
    return err(res, 'Review not found', reqId, 404) // hide non-approved from others
  ok(res, { review }, reqId)
})

route('PATCH', /^\/reviews\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  const user = requireRole(res, req, 'USER', reqId)
  if (!user) return
  const review = DB.reviews.find((r) => r.id === params.id && r.userId === user.id)
  if (!review) return err(res, 'Review not found', reqId, 404)
  if (review.status !== 'PENDING') return err(res, 'Only PENDING reviews can be edited', reqId, 409)
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    rating: { type: 'number', min: 1, max: 5 },
    comment: { type: 'string', minLength: 3, maxLength: 1000 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })
  if (body.rating !== undefined) review.rating = Math.round(body.rating)
  if (body.comment !== undefined) review.comment = body.comment
  review.updatedAt = new Date().toISOString()
  ok(res, { message: 'Review updated', review }, reqId)
})

route('DELETE', /^\/reviews\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  const review = DB.reviews.find((r) => r.id === params.id)
  if (!review) return err(res, 'Review not found', reqId, 404)
  if (user.role !== 'ADMIN' && review.userId !== user.id) return err(res, 'Forbidden', reqId, 403)
  DB.reviews.splice(DB.reviews.indexOf(review), 1)
  ok(res, { message: 'Review deleted' }, reqId)
})

// PATCH /reviews/:id/moderate  — ADMIN: approve or reject
route('PATCH', /^\/reviews\/(?<id>[^/]+)\/moderate$/, async (req, res, { params, reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const review = DB.reviews.find((r) => r.id === params.id)
  if (!review) return err(res, 'Review not found', reqId, 404)

  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    status: { required: true, type: 'string', enum: ['APPROVED', 'REJECTED'] },
    note: { type: 'string', maxLength: 500 },
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  review.status = body.status.toUpperCase()
  review.moderationNote = body.note || null
  review.updatedAt = new Date().toISOString()

  pushNotification(
    review.userId,
    'REVIEW',
    `Review ${review.status.toLowerCase()}`,
    `Your review has been ${review.status.toLowerCase()}${body.note ? `: "${body.note}"` : '.'}`
  )

  ok(res, { message: `Review ${review.status}`, review }, reqId)
})

// ═══════════════════════════════════════════════════════════════════════════
// ███████████████████  NOTIFICATION  ███████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════
//
//  GET    /notifications              — USER: own  |  ADMIN: all
//  PATCH  /notifications/:id/read     — mark one as read
//  POST   /notifications/read-all     — mark all own as read
//  DELETE /notifications/:id          — delete one own notification
//  POST   /notifications/broadcast    — ADMIN: send to all users or by role
//

route('GET', '/notifications', async (req, res, { query, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return

  let list =
    user.role === 'ADMIN' ? DB.notifications : DB.notifications.filter((n) => n.userId === user.id)

  if (query.read !== undefined) list = list.filter((n) => String(n.read) === query.read)
  if (query.type) list = list.filter((n) => n.type === query.type.toUpperCase())
  if (query.userId && user.role === 'ADMIN') list = list.filter((n) => n.userId === query.userId)

  const { data, meta } = paginate([...list].reverse(), query)
  const unread = list.filter((n) => !n.read).length
  ok(res, { notifications: data, unread, meta }, reqId)
})

route('PATCH', /^\/notifications\/(?<id>[^/]+)\/read$/, async (req, res, { params, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  const notif = DB.notifications.find((n) => n.id === params.id && n.userId === user.id)
  if (!notif) return err(res, 'Notification not found', reqId, 404)
  notif.read = true
  ok(res, { notification: notif }, reqId)
})

route('POST', '/notifications/read-all', async (req, res, { reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  const own = DB.notifications.filter((n) => n.userId === user.id && !n.read)
  own.forEach((n) => {
    n.read = true
  })
  ok(res, { message: `Marked ${own.length} notification(s) as read` }, reqId)
})

route('DELETE', /^\/notifications\/(?<id>[^/]+)$/, async (req, res, { params, reqId }) => {
  const user = requireAuth(res, req, reqId)
  if (!user) return
  const idx = DB.notifications.findIndex(
    (n) => n.id === params.id && (n.userId === user.id || user.role === 'ADMIN')
  )
  if (idx === -1) return err(res, 'Notification not found', reqId, 404)
  DB.notifications.splice(idx, 1)
  ok(res, { message: 'Notification deleted' }, reqId)
})

// POST /notifications/broadcast  — ADMIN only
route('POST', '/notifications/broadcast', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const body = await parseBody(req)
  const { valid, errors } = validate(body, {
    title: { required: true, type: 'string', minLength: 1, maxLength: 120 },
    message: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
    role: { type: 'string', enum: ['ADMIN', 'USER'] }, // optional filter
  })
  if (!valid) return err(res, 'Validation failed', reqId, 422, { errors })

  const targets = DB.users.filter(
    (u) => !u.deletedAt && (!body.role || u.role === body.role.toUpperCase())
  )
  targets.forEach((u) => pushNotification(u.id, 'BROADCAST', body.title, body.message))
  ok(res, { message: `Broadcast sent to ${targets.length} user(s)`, count: targets.length }, reqId)
})

// ═══════════════════════════════════════════════════════════════════════════
// ████████████████████████  UTILITY  ██████████═════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

route('GET', '/', async (req, res, { reqId }) => {
  ok(
    res,
    {
      name: 'Mock API Server',
      version: CONFIG.VERSION,
      timestamp: new Date().toISOString(),
      docs: `http://localhost:${CONFIG.PORT}/docs`,
      spec: `http://localhost:${CONFIG.PORT}/openapi.json`,
      controllers: {
        AUTH: [
          'POST /auth/register',
          'POST /auth/login',
          'POST /auth/logout',
          'GET /auth/me',
          'POST /auth/refresh',
        ],
        USER: ['PATCH|DELETE /user'],
        FOUNDATION: [
          'CRUD /foundation/business[/:id]',
          'CRUD /foundation/store[/:id]',
          'CRUD /foundation/catalog[/:id]',
          'CRUD /foundation/product[/:id]',
          'CRUD /foundation/inventory[/:productId]',
        ],
        CART: ['GET|POST|PATCH|DELETE /cart'],
        ORDER: [
          'POST /orders',
          'GET /orders',
          'GET /orders/:id',
          'POST /orders/:id/cancel',
          'PATCH /orders/:id/status [ADMIN]',
        ],
        REVIEW: [
          'POST /reviews',
          'GET /reviews',
          'GET|PATCH|DELETE /reviews/:id',
          'PATCH /reviews/:id/moderate [ADMIN]',
        ],
        NOTIFICATION: [
          'GET /notifications',
          'PATCH /notifications/:id/read',
          'POST /notifications/read-all',
          'DELETE /notifications/:id',
          'POST /notifications/broadcast [ADMIN]',
        ],
        UTILITY: [
          'GET /',
          'GET /health [ADMIN]',
          'POST /cache-clear [ADMIN]',
          'GET /db-snapshot [ADMIN]',
          'GET /openapi.json',
          'GET /docs',
        ],
      },
    },
    reqId
  )
})

route('GET', '/health', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const mem = process.memoryUsage(),
    toMB = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`
  ok(
    res,
    {
      status: 'healthy',
      uptimeSec: Math.floor(process.uptime()),
      memory: { rss: toMB(mem.rss), heapUsed: toMB(mem.heapUsed), heapTotal: toMB(mem.heapTotal) },
      config: {
        port: CONFIG.PORT,
        tokenTtl: `${CONFIG.TOKEN_TTL_MS / 3_600_000}h`,
        rateLimit: `${CONFIG.RATE_LIMIT} req/min per IP`,
      },
      db: {
        users: DB.users.filter(isAlive).length,
        usersDeleted: DB.users.filter((u) => u.deletedAt).length,
        activeSessions: Object.keys(DB.sessions).length,
        businesses: DB.businesses.filter(isAlive).length,
        stores: DB.stores.filter(isAlive).length,
        catalogs: DB.catalogs.filter(isAlive).length,
        products: DB.products.filter(isAlive).length,
        inventory: DB.inventory.length,
        carts: DB.carts.length,
        orders: DB.orders.length,
        reviews: DB.reviews.length,
        notifications: DB.notifications.length,
      },
      timestamp: new Date().toISOString(),
    },
    reqId
  )
})

route('POST', '/cache-clear', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  const count = Object.keys(DB.sessions).length
  for (const k of Object.keys(DB.sessions)) delete DB.sessions[k]
  ok(
    res,
    {
      message: 'All sessions invalidated',
      sessionsCleared: count,
      timestamp: new Date().toISOString(),
    },
    reqId
  )
})

route('GET', '/db-snapshot', async (req, res, { reqId }) => {
  if (!requireRole(res, req, 'ADMIN', reqId)) return
  ok(
    res,
    {
      _warning: 'Debug endpoint — disable in production.',
      snapshot: {
        users: DB.users.map(safeUser),
        sessions: Object.entries(DB.sessions).map(([t, s]) => ({
          tokenPrefix: t.slice(0, 8) + '…',
          userId: s.userId,
          expiresAt: new Date(s.expiresAt).toISOString(),
          expired: Date.now() > s.expiresAt,
        })),
        businesses: DB.businesses,
        stores: DB.stores,
        catalogs: DB.catalogs,
        products: DB.products,
        inventory: DB.inventory,
        carts: DB.carts,
        orders: DB.orders,
        reviews: DB.reviews,
        notifications: DB.notifications,
      },
    },
    reqId
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// ████████████████  OPENAPI 3.1 SPEC  ██████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════
//  GET /openapi.json  — machine-readable spec (paste into Swagger UI / Postman / Insomnia)
//  GET /docs          — self-contained Swagger UI HTML, no local files needed

// GET /openapi.json
route('GET', '/openapi.json', async (req, res, { reqId }) => {
  const host = req.headers.host || `localhost:${CONFIG.PORT}`
  const spec = buildOpenAPISpec(host, CONFIG.VERSION)
  const body = JSON.stringify(spec, null, 2)
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Request-Id': reqId,
  })
  res.end(body)
})

// GET /docs  — self-contained Swagger UI HTML (no local assets)
route('GET', '/docs', async (req, res, { reqId }) => {
  const specUrl = `/openapi.json`
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mock API — Swagger UI</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css" />
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f6f8fb; font-family: system-ui, sans-serif; color: #0f172a; }
    #top-bar {
      background: #ffffff;
      border-bottom: 1px solid #dbe2ea;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    #top-bar .logo {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    #top-bar .badge {
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #bfdbfe;
    }
    #top-bar .pill {
      margin-left: auto;
      font-size: 11px;
      color: #475569;
    }
    #swagger-ui { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .swagger-ui { color: #0f172a !important; }
    .swagger-ui .info .title { color: #0f172a !important; }
    .swagger-ui .info { background: transparent !important; }
    .swagger-ui .scheme-container { background: #ffffff !important; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important; border-bottom: 1px solid #dbe2ea; }
    .swagger-ui .opblock-tag { color: #0f172a !important; border-bottom: 1px solid #e2e8f0 !important; }
    .swagger-ui .opblock { border-radius: 8px !important; margin: 8px 0 !important; }
    .swagger-ui .opblock-summary { border-color: #e2e8f0 !important; }
    .swagger-ui select, .swagger-ui input, .swagger-ui textarea { background: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important; }
    .swagger-ui .btn { border-radius: 6px !important; font-weight: 600 !important; }
    .swagger-ui .btn.authorize { background: #1d4ed8 !important; border-color: #1d4ed8 !important; color: #fff !important; }
    .swagger-ui .model-box, .swagger-ui .model { background: #ffffff !important; color: #0f172a !important; }
    .swagger-ui table thead tr th, .swagger-ui table thead tr td { border-color: #e2e8f0 !important; color: #64748b !important; }
    .swagger-ui .response-col_status { color: #2563eb !important; }
    .swagger-ui .opblock .opblock-section-header,
    .swagger-ui .responses-table,
    .swagger-ui .parameters-container {
      background: #ffffff !important;
    }
  </style>
</head>
<body>
  <div id="top-bar">
    <span class="logo">⚡ Mock API Server</span>
    <span class="badge">v${CONFIG.VERSION}</span>
    <span class="pill">Pure Node.js · Zero deps · OpenAPI 3.1</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url            : "${specUrl}",
        dom_id         : "#swagger-ui",
        presets        : [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout         : "StandaloneLayout",
        deepLinking    : true,
        tryItOutEnabled: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        filter         : true,
        syntaxHighlight: { activate: true, theme: "github" },
      });
    };
  </script>
</body>
</html>`
  sendRaw(res, 200, 'text/html; charset=utf-8', html, reqId)
})

// ═══════════════════════════════════════════════════════════════════════════
//  HTTP SERVER
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const start = Date.now()
  const reqId = makeRequestId()

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('X-Request-Id', reqId)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    logReq('OPTIONS', req.url, 204, Date.now() - start, reqId)
    return
  }

  const ip = req.socket.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    send(
      res,
      429,
      {
        success: false,
        error: `Rate limit exceeded — max ${CONFIG.RATE_LIMIT} req/min`,
        retryAfterMs: CONFIG.RATE_WINDOW_MS,
      },
      reqId
    )
    logReq(req.method, req.url, 429, Date.now() - start, reqId)
    return
  }

  const match = matchRoute(req.method, req.url)
  if (!match) {
    send(res, 404, { success: false, error: `Cannot ${req.method} ${req.url}` }, reqId)
    logReq(req.method, req.url, 404, Date.now() - start, reqId)
    return
  }

  const _wh = res.writeHead.bind(res)
  let _status = 200
  res.writeHead = (code, ...rest) => {
    _status = code
    return _wh(code, ...rest)
  }

  try {
    await match.handler(req, res, { ...match, reqId })
  } catch (e) {
    console.error(`\n${C.red}[UNHANDLED]${C.reset} ${e.stack}\n`)
    if (!res.headersSent) {
      send(res, 500, { success: false, error: 'Internal server error' }, reqId)
      _status = 500
    }
  }

  logReq(req.method, req.url, _status, Date.now() - start, reqId)
})

server.listen(CONFIG.PORT, () => {
  console.log(`
${C.cyan}${C.bold}  ╔════════════════════════════════════════════════╗
  ║         Mock API Server  v${CONFIG.VERSION}               ║
  ║         Pure Node.js http · zero deps          ║
  ╚════════════════════════════════════════════════╝${C.reset}

  ${C.green}●${C.reset}  API     →  http://localhost:${C.bold}${CONFIG.PORT}${C.reset}
  ${C.blue}◈${C.reset}  Docs    →  http://localhost:${C.bold}${CONFIG.PORT}/docs${C.reset}
  ${C.magenta}◉${C.reset}  Spec    →  http://localhost:${C.bold}${CONFIG.PORT}/openapi.json${C.reset}

  ${C.yellow}⏱${C.reset}  Token TTL  ${C.bold}${CONFIG.TOKEN_TTL_MS / 3_600_000}h${C.reset}
  ${C.magenta}🛡${C.reset}  Rate limit ${C.bold}${CONFIG.RATE_LIMIT} req/min per IP${C.reset}

  ${C.dim}Controllers: AUTH · USER · FOUNDATION · CART · ORDER · REVIEW · NOTIFICATION · UTILITY${C.reset}
  ${C.dim}Env: PORT  TOKEN_TTL_MS  RATE_LIMIT  HASH_SALT${C.reset}
`)
})
