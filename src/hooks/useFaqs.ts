import { useEffect, useState } from 'react';
import type { FaqItem } from '@/lib/blogHtml';
import { blogPayload } from '@/services/blog';
import { listLiveFaqs } from '@/services/faq';

/** The live questions for / or /faq. worker/index.ts sends them with the page; arriving from another page, they load here. */
export function useFaqs(path: '/' | '/faq') {
  const [faqs, setFaqs] = useState<FaqItem[] | null>(() => blogPayload<{ faqs: FaqItem[] }>(path)?.faqs ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (faqs) return;
    listLiveFaqs(path === '/').then(setFaqs).catch(() => setFailed(true));
  }, []);
  return { faqs, failed };
}
