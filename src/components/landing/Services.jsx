/** Five cards on purpose: different widths, different heights, staggered. Every one describes something the app really does. */
export default function Services() {
  return (
    <section id="services" className="lp-services" aria-labelledby="services-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-kicker">What you get</p>
          <h2 id="services-title">Everything is built around the conversation</h2>
          <p>No feed, no followers. A place to practise with real people and keep what you learn.</p>
          <p className="lp-swipe" aria-hidden="true">Swipe</p>
        </div>
        <div className="lp-bento" role="group" aria-label="What you get: five features" tabIndex={0}>
          <article className="lp-card lp-card--a" data-reveal>
            <span className="lp-num" aria-hidden="true">01</span>
            <h3>Corrections inside the chat</h3>
            <p>A native speaker, or a learner at B1 or above, edits your sentence right where you wrote it. You see exactly what changed, and accept it or not.</p>
            <p className="lp-demo" aria-label="Example: Yo soy hambre is corrected to Yo tengo hambre">
              <del>Yo soy hambre</del> <ins>Yo tengo hambre</ins>
              <small>Red is what you wrote, green is the correction.</small>
            </p>
          </article>

          <article className="lp-card lp-card--b" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">02</span>
            <h3>Matched by language, not by popularity</h3>
            <p>Your native language and the one you are learning decide who you see. The best match is someone who wants exactly what you can offer.</p>
          </article>

          <article className="lp-card lp-card--c" data-reveal>
            <span className="lp-num" aria-hidden="true">03</span>
            <h3>A phrasebook that remembers</h3>
            <p>Accepted corrections are saved for you. Add a picture from Unsplash to make a phrase easier to recall.</p>
            <ul className="lp-tags" aria-label="What you can save"><li>phrases</li><li>idioms</li><li>slang</li></ul>
          </article>

          <article className="lp-card lp-card--d" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">04</span>
            <h3>Points for helping, a bounty when you are stuck</h3>
            <p>Every accepted correction earns you points. Spend 50 on a bounty to put a message in front of other speakers; if nobody helps in two days, you get them back.</p>
            <p className="lp-big" aria-hidden="true">+5</p>
          </article>

          <article className="lp-card lp-card--e" data-reveal style={{ '--d': '.2s' }}>
            <span className="lp-num" aria-hidden="true">05</span>
            <h3>Safe by default</h3>
            <p>New contacts arrive as requests. You can block or report anyone.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
