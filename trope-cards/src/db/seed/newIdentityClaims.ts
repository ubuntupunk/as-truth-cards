import type { ClaimSeed } from './types'

export type IdentityClaimSeed = ClaimSeed & {
  evidenceRequirement: string
}

export const newIdentityClaims: IdentityClaimSeed[] = [
  {
    cardSlug: 'jesus-is-a-muslim',
    statement:
      'Islamic theology presents Jesus as a prophet and Messiah within its account of earlier revelation.',
    claimType: 'THEOLOGICAL',
    status: 'ESTABLISHED',
    evidenceRequirement:
      "Primary Qur'anic passages plus authoritative Islamic theological commentary.",
  },
  {
    cardSlug: 'jesus-is-a-muslim',
    statement:
      'The Arabic term muslim can be used theologically for one who submits to God, allowing Islamic traditions to describe earlier prophets as submitting to God.',
    claimType: 'THEOLOGICAL',
    status: 'CONTESTED',
    evidenceRequirement:
      'Primary terminology plus representative classical and contemporary theological interpretation.',
  },
  {
    cardSlug: 'jesus-is-a-muslim',
    statement:
      "Applying the modern confessional category 'Muslim' to first-century Jesus can involve a retrospective identity classification.",
    claimType: 'INTERPRETIVE',
    status: 'CONTESTED',
    evidenceRequirement:
      'Compare historical usage of the category with Islamic theological usage.',
  },
  {
    cardSlug: 'jesus-was-a-palestinian',
    statement:
      "Calling Jesus, Mary, or Joseph 'Palestinian' requires distinguishing ancient geography and terminology from modern Palestinian national identity.",
    claimType: 'HISTORICAL',
    status: 'CONTESTED',
    evidenceRequirement:
      'Primary historical/geographical sources and scholarship on Roman Judaea, Syria Palaestina, and modern Palestinian identity.',
  },
  {
    cardSlug: 'jesus-was-a-palestinian',
    statement:
      "The modern national identity 'Palestinian' should not be assumed to have the same meaning when projected onto first-century figures.",
    claimType: 'INTERPRETIVE',
    status: 'CONTESTED',
    evidenceRequirement:
      'Historical chronology of the terminology and development of modern national identities.',
  },
  {
    cardSlug: 'muhammad-was-a-zionist',
    statement:
      "The Qur'an contains passages concerning the Children of Israel and their relationship to the land.",
    claimType: 'THEOLOGICAL',
    status: 'ESTABLISHED',
    evidenceRequirement:
      "Primary Qur'anic text, translation/version, and textual context.",
  },
  {
    cardSlug: 'muhammad-was-a-zionist',
    statement:
      'References to the Children of Israel and the land do not by themselves establish that Muhammad held the modern political ideology of Zionism.',
    claimType: 'INTERPRETIVE',
    status: 'CONTESTED',
    evidenceRequirement:
      "Compare Qur'anic textual evidence with the historical development and definition of modern political Zionism.",
  },
  {
    cardSlug: 'land-of-the-children-of-israel',
    statement:
      "The Qur'an contains passages that refer to the Children of Israel and a land associated with them.",
    claimType: 'THEOLOGICAL',
    status: 'ESTABLISHED',
    evidenceRequirement:
      "Primary Qur'anic passages with exact verse references and translation metadata.",
  },
  {
    cardSlug: 'land-of-the-children-of-israel',
    statement:
      'The theological meaning of those passages and their implications for modern territorial sovereignty are subjects of interpretation rather than identical propositions.',
    claimType: 'INTERPRETIVE',
    status: 'CONTESTED',
    evidenceRequirement:
      'Multiple representative exegetical interpretations and modern scholarship.',
  },
]
