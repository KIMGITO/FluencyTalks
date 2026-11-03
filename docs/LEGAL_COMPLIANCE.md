# Legal compliance

**We follow Vietnamese law.** The governing texts are Law 91/2025/QH15 (personal data protection), Decree 356/2025/ND-CP and Decree 333/2026/ND-CP (cybersecurity). Decree 13/2023 and Decree 53/2022 are superseded, so older guidance based on them is out of date.

This was checked on 3 November 2026 against English translations of Law 91/2025 and Decree 356/2025, and a law firm's summary of Decree 333/2026. **It isn't legal advice.** Have a lawyer confirm it before relying on it.

What we keep and for how long is in [Data retention](DATA_RETENTION.md), along with its legal basis.

## What the product does today

- **Minimum age:** 16, confirmed by a checkbox at onboarding.
- **Consent:** age, terms and privacy are recorded with their versions, and proof is kept permanently in a tamper-evident ledger.
- **Member rights:** the privacy page publishes the [response limits](DATA_RETENTION.md#answer-a-request-from-a-member). Settings offers export, and account deletion works for real.
- **Current legal versions** (`src/lib/legalVersions.ts`): privacy 3, terms 1, age 1. The exact text of each is in `supabase/legal/`.
- **Hosting disclosure:** the privacy policy says the database is hosted outside Vietnam, in Ireland.
- **Outside processors:** Supabase (hosting), Cloudflare (website), MyMemory (only text someone taps Translate on) and Unsplash (image searches).

## Changing the privacy policy or terms

CI fails until you do all of this:

1. Bump the version in [legalVersions.ts](../src/lib/legalVersions.ts).
2. Run `npm run build`, then `node scripts/legal-text.mjs write`.
3. Add the new file's text to `consent_documents` in a migration. Without that row, new consents have no `document_sha256`.

Existing members stay on the version they accepted, so you may also need to ask them to accept the new one.

## Before you rely on this

### Legal gaps that code can't fix

1. **Cross-border transfer filing.** Our database is in Ireland (`eu-west-1`), and using a platform abroad to process data collected in Vietnam counts as a transfer (Law 91/2025 Art. 20.1(c)). An impact assessment dossier must go to the authority **within 60 days of the first transfer** (Art. 20.2, Decree 356/2025 Art. 18). Translation, image search and the write-once bucket may need to be covered too.
2. **Storing data in Vietnam.** A company registered in Vietnam that provides these services has to store regulated data, including personal information and account data, in Vietnam (Decree 333/2026 Art. 19.2). A foreign company only has to after an order from the Ministry of Public Security (Art. 19.3, 19.6). **Which one are we?** If registered in Vietnam, the current hosting may not comply, and that decides where the write-once bucket should be.
3. **Who the data controller is.** Consent is only valid if people are told who the controller is (Law 91/2025 Art. 9.2(b)), and the policy only says "The Fluency Talks". It needs the legal name and address of whoever runs it.
4. **Impact assessment and DPO.** Processing personal data needs its own impact assessment dossier, sent to the authority **within 60 days of first processing** (Law 91/2025 Art. 21.1), and Decree 356/2025 has rules on data protection personnel (Art. 13–14). Whether exemptions apply needs checking.

### Product changes the law may require

5. **One checkbox covers everything.** Consent must be given for each purpose (Law 91/2025 Art. 9.4(a)), and ours bundles age, terms and privacy in one tick. The ledger records exactly that, so splitting it needs a product decision.
6. **Existing members** accepted privacy v1, which didn't state these periods. They probably need telling, and may need to accept the newer version. Nothing asks them to yet.
7. **Cookies and tracking.** Social and communication services must offer opting out of cookies and a "do not track" option (Law 91/2025 Art. 29.3–4). Not reviewed here.
8. **Vietnamese-language policy.** The pages are English only, and people must be properly informed for consent to count.
9. **Social network rules.** Decree 147/2024 can require account verification by phone or ID number, and applies to foreign providers above 100,000 monthly Vietnamese visits. Not reviewed here.
10. **Age wording.** The app says 16 or older, while the stored consent kind is still named `age_18` and a report reason says "Seems under 18". Confirm the intended age, and whether members under 18 need anything more.

### For your lawyer to confirm

11. **Permanent consent proof.** Storing data only as long as its purpose needs is a principle of the law (Art. 3.3), and this proof can't be deleted if someone asks. The defence is that we must be able to prove consent. A long fixed period, such as the 3-year claim limit plus a margin, is the alternative if they prefer.
12. **Whether 100-year locks are acceptable,** given they can't honour a deletion order. A shorter lock, renewed as it nears its end, is the alternative.
13. **Whether Decree 333's 12-month log rule covers Supabase's own auth logs.** Sign-in records with IP addresses (`auth.audit_log_entries`) are outside this system, and their retention depends on Supabase.
14. **The periods themselves.** Decree 333 is based on a law firm's summary here, not the decree's text. Translations may also differ from the Vietnamese originals, which are what count.
15. **The wording of the public pages,** including the privacy policy, should be reviewed before relying on them.

## Sources

- [Law 91/2025/QH15, English translation](https://www.dpo-india.com/Resources/Privacy_Regulations_in_Asia_Pacific_Countries/Vietnam-Personal-Data-Protection-Law(PDPL)26.06.25-Law-No.91-2025-QH15.pdf)
- [Decree 356/2025/ND-CP, English translation](https://www.qtsc.com.vn/uploads/files/2026/02/02/356_2025_ND-CP_689146.pdf)
- [EY: Decree 333/2026/ND-CP](https://www.ey.com/en_vn/technical/tax/tax-and-law-updates/legal-alert-decree-no-333-2026-nd-cp-providing-detailed-guidance-on-a-number-of-articles-of-the-law-on-cybersecurity) and [Duane Morris](https://blogs.duanemorris.com/vietnam/2026/08/27/vietnams-cybersecurity-reset-three-new-decrees-redefine-compliance-for-foreign-investors-and-fies/)
- [Civil Code 2015 limitation periods: DB Legal](https://dblegal.vn/news/litigation-in-vietnam/legal-grounds-and-statute-of-limitations-for-filing-a-lawsuit-in-vietnam-a-detailed-guide-1275.html)
- [Decree 147/2024: Tilleke & Gibbins](https://www.tilleke.com/insights/a-closer-look-at-vietnams-decree-147-on-internet-services-and-online-information/)
