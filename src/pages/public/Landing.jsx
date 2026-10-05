import { GlobalStyles, Header, Hero, Stats, About, HowItWorks, Languages, Split, Features, Testimonial, Faq, Cta, Footer } from '@/components/landing';
import { C, FONT } from '@/theme/theme';

export default function Landing() {
  return (
    <div style={{ fontFamily: FONT, color: C.ink, background: C.surface, lineHeight: 1.5, overflowX: 'hidden' }}>
      <GlobalStyles />
      <Header />
      <Hero />
      {/* <Stats /> */}
      <div className='py-2'></div>
      <About />
      <HowItWorks />
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
