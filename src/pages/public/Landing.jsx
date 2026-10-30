import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PublicShell, Hero, Marquee, Intro, Services, Languages, Roles, Project, Faq, Cta, StickyCta } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '@/lib/site';
import '@/styles/landing.css';

export default function Landing() {
  useSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: '/' });
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 60);
    return () => window.clearTimeout(t);
  }, [hash]);
  return (
    <PublicShell>
      <Hero />
      {/* <Marquee /> */}
      <Intro />
      <Services />
      <Languages />
      <Roles />
      {/* <Project /> */}
      <Faq />
      <Cta />
      <StickyCta />
    </PublicShell>
  );
}
