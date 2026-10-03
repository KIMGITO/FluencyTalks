import React, { useState, useEffect } from 'react';
import { C, IMG, SERIF } from '../../theme/theme';
import ImageSection from './ImageSection';

const TESTIMONIALS = [
  {
    id: 1,
    quote:
      "I studied French for years and froze when I spoke. Three weeks of chats with Camille and I finally ordered dinner in Paris without panic.",
    author: "Amina Odhiambo",
    role: "Learning French, member since 2025",
    img: IMG.team, // replace or keep dynamic per testimonial if needed
    tint: "#fff0ea",
  },
  {
    id: 2,
    quote:
      "The real-time conversation practice gave me the confidence I needed before moving to Berlin. It feels like chatting with a patient friend.",
    author: "David Kim",
    role: "Learning German, member since 2025",
    img: IMG.team,
    tint: "#f0f7ff",
  },
  {
    id: 3,
    quote:
      "I went from struggling with basic greetings to having 20-minute fluent discussions in Spanish in just two months. Absolute game changer!",
    author: "Elena Rostova",
    role: "Learning Spanish, member since 2026",
    img: IMG.team,
    tint: "#f3f0ff",
  },
];

export default function Testimonial() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const current = TESTIMONIALS[currentIndex];

  // Next / Prev handler with animation lock
  const handleSlideChange = (newIndex) => {
    if (isAnimating || newIndex === currentIndex) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsAnimating(false);
    }, 250); // Matches transition duration
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % TESTIMONIALS.length;
    handleSlideChange(nextIdx);
  };

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + TESTIMONIALS.length) % TESTIMONIALS.length;
    handleSlideChange(prevIdx);
  };

  // Autoplay functionality
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6000);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused]);

  return (
    <>
      <style>
        {`
          @keyframes fadeInSlide {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .testimonial-content-animate {
            animation: fadeInSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .nav-btn {
            background: #ffffff;
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
            color: ${C.ink};
          }
          .nav-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            background: #ffffff;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: all 0.3s ease;
            border: none;
            padding: 0;
          }
          .dot.active {
            width: 28px;
            border-radius: 12px;
            background: ${C.coral};
          }
        `}
      </style>

      <ImageSection
        id="stories"
        img={current.img}
        side="left"
        tint={current.tint}
        minHeight={560}
      >
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Quote Symbol */}
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 90,
              lineHeight: 0.6,
              color: C.coral,
              userSelect: 'none',
              marginBottom: 10,
            }}
          >
            “
          </div>

          {/* Animated Card Content */}
          <div
            key={current.id}
            className={!isAnimating ? 'testimonial-content-animate' : ''}
            style={{
              opacity: isAnimating ? 0 : 1,
              transition: 'opacity 0.25s ease-in-out',
              minHeight: 180,
            }}
          >
            <p
              style={{
                fontFamily: SERIF,
                fontSize: 'clamp(22px, 3vw, 30px)',
                lineHeight: 1.4,
                margin: '0 0 22px',
                color: C.ink,
              }}
            >
              {current.quote}
            </p>

            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              {current.author}
            </div>
            <div style={{ color: C.muted, marginTop: 4 }}>
              {current.role}
            </div>
          </div>

          {/* Navigation Controls & Pagination Dots */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 36,
              paddingTop: 20,
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            {/* Dots Indicator */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {TESTIMONIALS.map((item, idx) => (
                <button
                  key={item.id}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => handleSlideChange(idx)}
                />
              ))}
            </div>

            {/* Prev / Next Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="nav-btn"
                onClick={handlePrev}
                aria-label="Previous Testimonial"
              >
                ‹
              </button>
              <button
                className="nav-btn"
                onClick={handleNext}
                aria-label="Next Testimonial"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </ImageSection>
    </>
  );
}