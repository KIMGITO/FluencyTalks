// Which languages the message composer offers, and which is selected. No app imports: tested with node --test.

export interface ComposerProfile { learning_language_id?: string | null; native_language_id?: string | null }

/** The sender's own languages, the one being learned first (it's the default), without duplicates. */
export function composerLanguages(me: ComposerProfile | null | undefined): string[] {
  return [...new Set([me?.learning_language_id, me?.native_language_id].filter((x): x is string => !!x))];
}

/** Keep the current choice while it's still one of mine; otherwise fall back to the default (learning). */
export function pickComposerLanguage(options: string[], current: string | null | undefined): string {
  return current && options.includes(current) ? current : options[0] ?? '';
}

/** Short tab label: the ISO 639-3 code in capitals, e.g. "SWH", "ENG". */
export const languageTabLabel = (id: string) => id.toUpperCase();
