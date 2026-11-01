/** Five cards on purpose: different widths, different heights, staggered. Every one describes something the app really does. */
export default function Services() {
  return (
    <section id="services" className="lp-services" aria-labelledby="services-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-kicker">What you get</p>
          <h2 id="services-title">Everything is built around the conversation</h2>
          <p>No followers, no likes, no popularity contest. A place to practise with real people and keep what you learn.</p>
          <p className="lp-swipe" aria-hidden="true">Swipe</p>
        </div>
        <div className="lp-bento" role="group" aria-label="What you get: five features" tabIndex={0}>
          <article className="lp-card lp-card--a" data-reveal>
            <span className="lp-num" aria-hidden="true">01</span>
            <h3>Corrections inside the chat</h3>
            <p>A native speaker, or a learner at B1 or above, edits your sentence right where you wrote it. You see exactly what changed, and accept it or not.</p>
            <p className="lp-demo" aria-label="Example: an English speaker learning Vietnamese writes Tôi là đói, corrected to Tôi đói (I am hungry)">
              <del lang="vi">Tôi là đói</del> <ins lang="vi">Tôi đói</ins>
              <small>“I am hungry.” Red is what you wrote, green is the correction.</small>
            </p>
          </article>

          <article className="lp-card lp-card--b" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">02</span>
            <h3>Matched by language, not by popularity</h3>
            <p>Your native language and the one you are learning decide who you see. A perfect swap ranks first, but you don't need one. Speak English and learning Chinese? You see every Chinese speaker, even one who is learning nothing, and every learner of English.</p>
          </article>

          <article className="lp-card lp-card--c" data-reveal>
            <span className="lp-num" aria-hidden="true">03</span>
            <h3>A phrasebook that remembers</h3>
            <p>Accept a correction and the fixed sentence is saved for you. Save any other message with one tap, and tap to translate the ones you don't understand.</p>
            <ul className="lp-tags" aria-label="What your Learning page keeps"><li>phrases</li><li>corrections</li><li>translations</li></ul>
          </article>

          <article className="lp-card lp-card--d" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">04</span>
            <h3>Points for helping, a bounty when you are stuck</h3>
            <p>You start with 100 points and earn 5 for each correction someone accepts. Stuck? Spend 50 on a bounty to put a question in front of people who know the language. If you don't accept an answer within 48 hours, you get them back.</p>
            <p className="lp-big" aria-hidden="true">+5</p>
          </article>

          <article className="lp-card lp-card--e" data-reveal style={{ '--d': '.2s' }}>
            <span className="lp-num" aria-hidden="true">05</span>
            <h3>Safe by default</h3>
            <p>New contacts arrive as requests you can decline. Block or report anyone; moderators review every report.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
