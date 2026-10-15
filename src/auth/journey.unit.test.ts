import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_RETURN_TO,
  MIN_PASSWORD_LENGTH,
  safeReturnTo,
  submitSignIn,
  submitSignUp,
  validateSignIn,
  validateSignUp,
} from './journey.js'

describe('safeReturnTo', () => {
  it('returns internal absolute path', () => {
    assert.equal(safeReturnTo('/account'), '/account')
    assert.equal(safeReturnTo('/research?card=x#section'), '/research?card=x#section')
  })

  it('falls back on protocol-relative //evil.example', () => {
    assert.equal(safeReturnTo('//evil.example'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('//evil.example/path'), DEFAULT_RETURN_TO)
  })

  it('falls back on backslash variants like /\\evil.example', () => {
    assert.equal(safeReturnTo('/\\evil.example'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('/\\\\evil.example'), DEFAULT_RETURN_TO)
  })

  it('falls back on absolute URLs', () => {
    assert.equal(safeReturnTo('https://evil.example'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('http://evil.example/path'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('javascript:alert(1)'), DEFAULT_RETURN_TO)
  })

  it('falls back on malformed/unsafe values', () => {
    assert.equal(safeReturnTo('account'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo(''), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo(null), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo(undefined), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo(123 as unknown as string), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo(' /account'), '/account') // trimmed
  })

  it('rejects whitespace and control characters', () => {
    assert.equal(safeReturnTo('/account '), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('/account\t'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('/account\n'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('/acc\u0000ount'), DEFAULT_RETURN_TO)
    assert.equal(safeReturnTo('/acc\u007fount'), DEFAULT_RETURN_TO)
  })

  it('rejects backslash anywhere', () => {
    assert.equal(safeReturnTo('/a\\b'), DEFAULT_RETURN_TO)
  })
})

describe('validateSignUp', () => {
  it('validates required name/email/password', () => {
    const v1 = validateSignUp({ name: '', email: '', password: '' })
    assert.equal(v1.ok, false)
    assert.ok(v1.message)
    const v2 = validateSignUp({ name: 'Alice', email: 'alice@example.com', password: 'x'.repeat(MIN_PASSWORD_LENGTH) })
    assert.equal(v2.ok, true)
  })

  it('rejects invalid email', () => {
    const v = validateSignUp({ name: 'A', email: 'not-an-email', password: 'x'.repeat(MIN_PASSWORD_LENGTH) })
    assert.equal(v.ok, false)
  })

  it('rejects short password', () => {
    const v = validateSignUp({ name: 'A', email: 'a@b.com', password: 'short' })
    assert.equal(v.ok, false)
  })
})

describe('validateSignIn', () => {
  it('requires email and password', () => {
    assert.equal(validateSignIn({ email: '', password: '' }).ok, false)
    assert.equal(validateSignIn({ email: 'a@b.com', password: 'pw' }).ok, true)
  })
})

describe('submitSignIn', () => {
  it('returns validation error when fields missing', async () => {
    const fake = { signIn: { email: async () => ({ error: null }) } }
    const res = await submitSignIn(fake as any, { email: '', password: '' })
    assert.equal(res.ok, false)
    assert.ok(res.error)
  })

  it('returns error from auth client', async () => {
    const fake = { signIn: { email: async () => ({ error: { message: 'Bad creds' } }) } }
    const res = await submitSignIn(fake as any, { email: 'a@b.com', password: 'pw' })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'Bad creds')
  })

  it('returns redirect on success with safe returnTo', async () => {
    const fake = { signIn: { email: async () => ({ error: null }) } }
    const res = await submitSignIn(fake as any, { email: 'a@b.com', password: 'pw' }, '//evil.example')
    assert.equal(res.ok, true)
    assert.equal(res.redirect, DEFAULT_RETURN_TO)
  })
})

describe('submitSignUp', () => {
  it('returns validation error when invalid', async () => {
    const fake = { signUp: { email: async () => ({ error: null }) } }
    const res = await submitSignUp(fake as any, { name: '', email: '', password: '' })
    assert.equal(res.ok, false)
  })

  it('returns error from client', async () => {
    const fake = { signUp: { email: async () => ({ error: { message: 'exists' } }) } }
    const res = await submitSignUp(fake as any, { name: 'A', email: 'a@b.com', password: 'x'.repeat(MIN_PASSWORD_LENGTH) })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'exists')
  })

  it('returns redirect on success', async () => {
    const fake = { signUp: { email: async () => ({ error: null }) } }
    const res = await submitSignUp(fake as any, { name: 'A', email: 'a@b.com', password: 'x'.repeat(MIN_PASSWORD_LENGTH) }, '/onboarding')
    assert.equal(res.ok, true)
    assert.equal(res.redirect, '/onboarding')
  })
})
