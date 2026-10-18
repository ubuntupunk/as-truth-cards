/**
 * Tests for the device-local participation preferences.
 *
 * These pin the reload-persistence contract of setup step 3's two optional
 * questions — including the honest defaults when nothing (or garbage) has
 * been stored, so a blank answer is never asserted on the user's behalf.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_PARTICIPATION_PREFERENCES,
  isParticipationAnswer,
  PARTICIPATION_PREFERENCES_STORAGE_KEY,
  readParticipationPreferences,
  saveParticipationPreferences,
} from './preferences'

/** A Map-backed Storage stand-in. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    data,
  }
}

describe('readParticipationPreferences', () => {
  it('defaults to "Decide later" for both questions', () => {
    assert.deepEqual(
      readParticipationPreferences(null),
      DEFAULT_PARTICIPATION_PREFERENCES,
    )
    assert.deepEqual(
      readParticipationPreferences(fakeStorage()),
      DEFAULT_PARTICIPATION_PREFERENCES,
    )
  })

  it('reads back what was saved — the reload-persistence contract', () => {
    const storage = fakeStorage()
    saveParticipationPreferences(
      { feedbackEmail: 'yes', academicParticipation: 'no' },
      storage,
    )
    assert.deepEqual(readParticipationPreferences(storage), {
      feedbackEmail: 'yes',
      academicParticipation: 'no',
    })
  })

  it('treats corrupt JSON as no choice yet', () => {
    const storage = fakeStorage({
      [PARTICIPATION_PREFERENCES_STORAGE_KEY]: '{not json',
    })
    assert.deepEqual(
      readParticipationPreferences(storage),
      DEFAULT_PARTICIPATION_PREFERENCES,
    )
  })

  it('falls back per field on unknown answer values', () => {
    const storage = fakeStorage({
      [PARTICIPATION_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        feedbackEmail: 'maybe',
        academicParticipation: 'yes',
      }),
    })
    assert.deepEqual(readParticipationPreferences(storage), {
      feedbackEmail: 'later',
      academicParticipation: 'yes',
    })
  })
})

describe('saveParticipationPreferences', () => {
  it('is a no-op without storage rather than throwing', () => {
    assert.doesNotThrow(() =>
      saveParticipationPreferences(DEFAULT_PARTICIPATION_PREFERENCES, null),
    )
  })
})

describe('isParticipationAnswer', () => {
  it('accepts only the three known answers', () => {
    assert.equal(isParticipationAnswer('yes'), true)
    assert.equal(isParticipationAnswer('no'), true)
    assert.equal(isParticipationAnswer('later'), true)
    assert.equal(isParticipationAnswer('maybe'), false)
    assert.equal(isParticipationAnswer(1), false)
    assert.equal(isParticipationAnswer(null), false)
  })
})
