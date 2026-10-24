import { GlobalStyles, Header, Hero, Stats, About, HowItWorks, Languages, Split, Features, Testimonial, Faq, Cta, Footer } from '@/components/landing';
import { C, FONT } from '@/theme/theme';
import { useSeo } from '@/hooks/useSeo';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '@/lib/site';

export default function Landing() {
  useSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: '/' });
  return (
    <div style={{ fontFamily: FONT, color: C.ink, background: C.surface, lineHeight: 1.5, overflowX: 'hidden' }}>
      <GlobalStyles />
      <Header />
      <Hero />
      {}
      <div className='py-2'></div>
      <About />
      {}
      <Languages />
      <Split />
      <Features />
      <Testimonial />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}
