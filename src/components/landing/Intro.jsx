export default function Intro() {
  return (
    <>
      <section className="lp-intro" aria-labelledby="intro-title">
        <div className="lp-wrap lp-intro__grid">
          <p className="lp-kicker lp-intro__label" data-reveal>Why it exists</p>
          <div className="lp-intro__body" data-reveal style={{ '--d': '.08s' }}>
            <h2 id="intro-title" className="lp-statement">Apps teach you words. <em>People teach you to talk.</em></h2>
            <p className="lp-lead">Flashcards only go so far. Fluency comes from real conversations with someone patient, curious and glad to help.</p>
          </div>
        </div>
      </section>
      <div className="lp-wrap">
        <ol className="lp-steps">
          <li data-reveal><span className="lp-num">One</span><h3>Say who you are</h3><p>Pick the language you speak natively and, if you like, the one you are learning and your level.</p></li>
          <li data-reveal style={{ '--d': '.1s' }}><span className="lp-num">Two</span><h3>Meet a match</h3><p>We show people whose languages fit yours. Message them; they can accept or decline.</p></li>
          <li data-reveal style={{ '--d': '.2s' }}><span className="lp-num">Three</span><h3>Talk, get corrected, keep it</h3><p>Your partner fixes a sentence inside the chat, you accept the change, and the phrase goes into your phrasebook.</p></li>
        </ol>
      </div>
    </>
  );
}
