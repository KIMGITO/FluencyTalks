import { HELLOS } from './greetings';

export default function Languages() {
  return (
    <section id="languages" className="lp-languages" aria-labelledby="languages-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal style={{ marginBottom: 0 }}>
          <p className="lp-kicker">Languages</p>
          <h2 id="languages-title">Say hello in more than forty languages</h2>
        </div>
        <ul className="lp-hellos  " aria-label="Hello in some of the languages you can practise">
          {HELLOS.map(([word, lang, size, dir], i) => (
            <li  key={word} data-reveal style={{ '--s': `${size}rem`, '--d': `${(i % 6) * 0.05}s` }}><span lang={lang} dir={dir} className="">{word}</span></li>
          ))}
        </ul>
       
      </div>
    </section>
  );
}
