/** Six cards on purpose: different widths, different heights, staggered. Every one describes something the app really does. */
export default function Services() {
  return (
    <section id="services" className="lp-services" aria-labelledby="services-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal>
          <p className="lp-kicker">What you get</p>
          <h2 id="services-title">Everything is built around the conversation</h2>
          <p>No popularity contest. A place to talk with real people, prove your level and keep what you learn.</p>
          <p className="lp-swipe" aria-hidden="true">Swipe</p>
        </div>
        <div className="lp-bento" role="group" aria-label="What you get: six features" tabIndex={0}>
          <article className="lp-card lp-card--a" data-reveal>
            <span className="lp-num" aria-hidden="true">01</span>
            <h3>Video calls on topics for your level</h3>
            <p>Talk one to one with a partner, face to face. Pick from more than 80 topics from A1 to C2, each with prompts and ideas, so the conversation never runs dry. Calls are never recorded, and your camera can stay off whenever you like.</p>
            <ul className="lp-tags" aria-label="Some of the topic areas"><li>people</li><li>food</li><li>travel</li><li>tech</li><li>and more</li></ul>
          </article>

          <article className="lp-card lp-card--b" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">02</span>
            <h3>Matched by language, not by popularity</h3>
            <p>Your native language and the one you are learning decide who you see. A perfect swap ranks first, but you don't need one. Speak English and learning Chinese? You see every Chinese speaker, even one who is learning nothing, and every learner of English. Add them as a partner to call them.</p>
          </article>

          <article className="lp-card lp-card--c" data-reveal>
            <span className="lp-num" aria-hidden="true">03</span>
            <h3>Corrections you keep</h3>
            <p>Between calls, chat in writing. A native speaker, or a learner who has passed a higher level, fixes your sentence right where you wrote it. Accept it and the phrase goes into your phrasebook.</p>
            <p className="lp-demo" aria-label="Example: an English speaker learning Vietnamese writes Tôi là đói, corrected to Tôi đói (I am hungry)">
              <del lang="vi">Tôi là đói</del> <ins lang="vi">Tôi đói</ins>
              <small>“I am hungry.” Red is what you wrote, green is the correction.</small>
            </p>
          </article>

          <article className="lp-card lp-card--d" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">04</span>
            <h3>A level you earn, not one you claim</h3>
            <p>After a topic call of at least 10 minutes, your partner rates you on five points. When 5 different partners have rated you and your average is 80% or more, you pass the level and the next one opens.</p>
            <p className="lp-big" aria-hidden="true">80%</p>
          </article>

          <article className="lp-card lp-card--e" data-reveal style={{ '--d': '.2s' }}>
            <span className="lp-num" aria-hidden="true">05</span>
            <h3>Points for helping</h3>
            <p>You start with 100 points and earn 5 for each correction someone accepts. Stuck? Spend 50 on a bounty. If you don't accept an answer within 48 hours, you get them back.</p>
          </article>

          <article className="lp-card lp-card--f" data-reveal style={{ '--d': '.1s' }}>
            <span className="lp-num" aria-hidden="true">06</span>
            <h3>Safe by default</h3>
            <p>Partner and message requests can be declined. Block or report anyone; moderators review every report. Members aged 12 to 15 join with a parent's agreement, and their calls are voice only.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
