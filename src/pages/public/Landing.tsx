import { Link } from 'react-router-dom';
import { Button, Logo, ThemeToggle, Card } from '@/components/ui';
import { LanguageChip } from '@/components/features';

// Swap this for your own image later.
const HERO_IMAGE =
  'https://plus.unsplash.com/premium_photo-1661962617265-b88538dc15e4?w=1600&auto=format&fit=crop&q=70&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzN8fHN0dWRlbnRhcyUyMGluJTIwbGlicmFyeXxlbnwwfHwwfHx8MA%3D%3D';

/* Small icon set (stroke icons, no dependency). */
const icons = {
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
};

function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const mainNav = [
  { label: 'How it works', href: '#how-it-works', icon: 'book', badge: 'bg-brand' },
  { label: 'Languages', href: '#languages', icon: 'globe', badge: 'bg-aqua' },
  { label: 'Community', href: '#community', icon: 'chat', badge: 'bg-accent' },
];

const sectionNav = [
  { label: 'Start practicing', to: '/signup' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Languages', href: '#languages' },
  { label: 'Log in', to: '/login' },
];

const steps = [
  { icon: 'chat', badge: 'bg-brand', title: 'Message a speaker', body: 'Pick a language and start a chat with a native speaker or a fluent learner.' },
  { icon: 'book', badge: 'bg-aqua', title: 'Get corrected in the chat', body: 'Your partner fixes mistakes right in the conversation, so you see the right form straight away.' },
  { icon: 'globe', badge: 'bg-accent', title: 'Save phrases, keep going', body: 'Keep the phrases you want to remember and build a daily practice habit.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Top bar */}
      <header className="bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <nav className="mr-4 hidden items-center gap-5 text-sm font-semibold lg:flex">
              {mainNav.map((item) => (
                <a key={item.label} href={item.href} className="flex items-center gap-2 hover:text-brand">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-on-brand ${item.badge}`}>
                    <Icon name={item.icon} className="h-3.5 w-3.5" />
                  </span>
                  {item.label}
                </a>
              ))}
            </nav>
            <ThemeToggle />
            <Link to="/login"><Button variant="ghost">Log in</Button></Link>
            <Link to="/signup"><Button className="rounded-full px-6 font-bold">Sign up</Button></Link>
          </div>
        </div>
      </header>

      {/* Dark section bar */}
      <div className="bg-ink text-bg">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto whitespace-nowrap px-4 py-3 text-sm">
          <span className="opacity-60">On this page</span>
          {sectionNav.map((item) =>
            item.to ? (
              <Link key={item.label} to={item.to} className="font-semibold hover:underline underline-offset-8">{item.label}</Link>
            ) : (
              <a key={item.label} href={item.href} className="font-semibold hover:underline underline-offset-8">{item.label}</a>
            )
          )}
        </nav>
      </div>

      {/* Photo banner, curved bottom edge, brand-blue wash */}
      <section
        className="relative overflow-hidden  bg-cover bg-center  bg-surface-2"
        style={{ backgroundImage: `url(${HERO_IMAGE})`, borderRadius: '0 0 50% 0' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-brand/60 via-brand/50 to-brand/5" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-32 pt-16 text-on-brand md:pb-40 md:pt-24">
          
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-extrabold md:text-5xl">
            Learn a language by  talking.
          </h1>
          <p className="mt-4 max-w-xl text-lg opacity-90">
            Message native speakers and fluent learners, get corrected as you chat, and build a habit that sticks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-full bg-on-brand px-7 py-3 font-bold text-brand shadow-pop transition hover:opacity-90">
              Start for free
            </Link>
            <Link to="/login" className="rounded-full border border-on-brand/60 px-7 py-3 font-bold text-on-brand transition hover:bg-on-brand/10">
              I have an account
            </Link>
          </div>
        </div>
      </section>

     

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-6 bg-surface-2">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-display text-3xl font-extrabold md:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg bg-surface p-6 shadow-card">
                <span className={`grid h-12 w-12 place-items-center rounded-full text-on-brand ${step.badge}`}>
                  <Icon name={step.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold">{i + 1}. {step.title}</h3>
                <p className="mt-2 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing call to action */}
      <section id="community" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-gradient-to-br from-brand to-aqua p-8 text-on-brand md:flex-row md:items-center md:p-12">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Ready for your first conversation?</h2>
            <p className="mt-2 opacity-90">Create a free account and message someone today.</p>
          </div>
          <Link to="/signup" className="rounded-full bg-on-brand px-8 py-3 font-bold text-brand shadow-pop transition hover:opacity-90">
            Sign up free
          </Link>
        </div>
      </section>
    </div>
  );
}