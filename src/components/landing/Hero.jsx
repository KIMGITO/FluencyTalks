import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { C, IMG, SERIF, wrap, btn, photo, bubble } from '../../theme/theme';
import { heroCSS } from '../../theme/componentStyles';
import { Words } from './Reveal';
import { useJoinLink } from './useJoinLink';

const slides = [
  {
    img: IMG.talk,
    tag: 'Learn in the moment',
    title: 'Get corrected while you chat, not after you quit.',
    sub: 'Your partner fixes mistakes right in the conversation, so the right form sticks.',
  },
  {
    img: IMG.hero,
    tag: 'Real conversation. Real people.',
    title: 'Speak a new language with the people who speak it.',
    sub: 'Friendly one-to-one practice with native and fluent speakers, matched to your level.',
  },
  {
    img: IMG.online,
    tag: 'Any time, anywhere',
    title: 'Practice 40 languages from your own sofa.',
    sub: 'Text, voice or video. Drop in for ten minutes or stay for an hour.',
  },
];

const arrow = {
  width: 46,
  height: 46,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.7)',
  background: 'rgba(255,255,255,0.12)',
  color: C.white,
  fontSize: 20,
  cursor: 'pointer',
  fontWeight: 800,
  padding: 0,
};


export default function Hero() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const join = useJoinLink();
  const n = slides.length;
  const tx = useRef(0);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), 6500);
    return () => clearTimeout(t);
  }, [idx, paused, n]);
  const go = (d) => setIdx((i) => (i + d + n) % n);

  return (
    <section
      className="ft-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        tx.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const d = e.changedTouches[0].clientX - tx.current;
        if (Math.abs(d) > 50) go(d < 0 ? 1 : -1);
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0 0 0 clamp(48px, 10vw, 120px)',
        background: C.deep,
      }}
    >
      <style>{heroCSS}</style>
      <div
        style={{
          display: 'flex',
          width: `${n * 100}%`,
          transform: `translateX(-${(idx * 100) / n}%)`,
          transition: 'transform 1.1s cubic-bezier(.77,0,.18,1)',
        }}
      >
        {slides.map((s, i) => {
          const on = i === idx;
          return (
            <div
              key={s.title}
              style={{
                width: `${100 / n}%`,
                flex: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                className="ft-hzoom"
                style={{ position: 'absolute', inset: 0 }}
              >
                <div
                  style={{
                    ...photo(s.img),
                    position: 'absolute',
                    inset: 0,
                    animation: on ? 'ftZoom 10s ease-out forwards' : 'none',
                  }}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(100deg, ${C.deep} 12%, rgb(var(--c-brand) / 0.8) 50%, rgb(var(--c-aqua) / 0.3) 100%)`,
                }}
              />
              <div
                style={{
                  ...wrap,
                  position: 'relative',
                  padding:
                    'clamp(56px, 9vw, 100px) 24px clamp(124px, 14vw, 160px)',
                  minHeight: 420,
                }}
              >
                <h1
                  style={{
                    fontFamily: SERIF,
                    fontSize: 'clamp(30px, 6.2vw, 68px)',
                    lineHeight: 1.08,
                    color: C.white,
                    margin: '22px 0 20px',
                    maxWidth: 780,
                  }}
                >
                  <Words text={s.title} on={on} />
                </h1>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: 'clamp(16px, 2.2vw, 20px)',
                    maxWidth: 540,
                    margin: '0 0 34px',
                    ...(on
                      ? { animation: 'ftUp .8s .9s both' }
                      : { opacity: 0 }),
                  }}
                >
                  {s.sub}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                    ...(on
                      ? { animation: 'ftUp .8s 1.1s both' }
                      : { opacity: 0 }),
                  }}
                  className="flex justify-center "
                >
                  <Link to={join.to} style={btn(C.coral, C.white)}>
                    {join.signedIn ? 'Go to your profile' : 'Start talking free'}
                  </Link>
                  <a
                    href="#how"
                    style={btn('transparent', C.white, {
                      borderColor: C.white,
                    })}
                  >
                    See how it works
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="ft-bub"
        style={bubble(C.white, C.indigo, { right: '7%', top: 70 })}
      >
        ¿Cómo estás?
      </div>
      <div
        className="ft-bub"
        style={bubble(C.teal, C.white, {
          right: '15%',
          top: 150,
          borderRadius: '22px 22px 4px 22px',
          animationDelay: '1s',
        })}
      >
        Très bien, merci!
      </div>
      <div
        className="ft-bub"
        style={bubble(C.sun, C.ink, {
          right: '4%',
          top: 230,
          animationDelay: '2s',
        })}
      >
        Karibu sana!
      </div>

      <div
        className="ft-ctlw"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 40 }}
      >
        {/* <div className="ft-ctl" style={wrap}>
          <button
            className="ft-arrow ft-prev"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            style={arrow}
          >
            ‹
          </button>
          <button
            className="ft-arrow ft-next"
            aria-label="Next slide"
            onClick={() => go(1)}
            style={arrow}
          >
            ›
          </button>
          <div className="ft-dots" style={{ display: 'flex', gap: 8 }}>
            {slides.map((s, i) => (
              <button
                key={s.tag}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIdx(i)}
                style={{
                  width: i === idx ? 56 : 14,
                  height: 8,
                  borderRadius: 8,
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.4)',
                  overflow: 'hidden',
                  transition: 'width .4s',
                }}
              >
                {i === idx && (
                  <span
                    key={idx}
                    style={{
                      display: 'block',
                      height: '100%',
                      background: C.sun,
                      animation: 'ftFill 6.5s linear both',
                      animationPlayState: paused ? 'paused' : 'running',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div> */}
      </div>
    </section>
  );
}
