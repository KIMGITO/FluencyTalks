// What a new member agrees to. Each version needs a consent_documents row: scripts/legal-text.mjs.
export const LEGAL_VERSIONS = {
  privacy: '3',
  terms: '1',
  age: '1',
  minor_rules: '1',
} as const;

// What the member ticks, word for word as stored in consent_documents (supabase/migrations/…_age_and_guardians.sql).
// tests/unit/legalWording.test.ts fails if the two drift apart. A change needs a new version and a new row.
export const LEGAL_WORDING = {
  age: 'My date of birth is correct and I am 12 or older. If I am under 16, I understand a parent or guardian must agree before I can use The Fluency Talks, and that if they refuse, my account and its data are deleted at once.',
  minor_rules: 'I understand that members aged 12 to 15 use The Fluency Talks, and I agree to these rules. Calls with a member under 16 are voice only, with no camera. I will never ask a member under 16 for photos, their address, school, phone number or social media, never ask to meet them, and never move a conversation with them off The Fluency Talks. I will never send them, or ask them for, sexual, violent or other harmful content, gifts or money. Breaking these rules closes my account for good, and suspected abuse or grooming of a child is reported, with the evidence The Fluency Talks holds, to the police and the authorities responsible for protecting children. If I am under 16 and anyone makes me uncomfortable, I will stop the chat or call, use Report, and tell a parent or guardian.',
} as const;
