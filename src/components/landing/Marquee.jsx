import { HELLOS } from './greetings';

/** A slow ticker of greetings under the hero. Decorative (the Languages section lists them for everyone); it pauses on hover and stops for reduced motion. */
export default function Marquee() {
  const row = (key) => (
    <span key={key}>{HELLOS.map(([word, lang, , dir]) => <span key={word} lang={lang} dir={dir}>{word}</span>)}</span>
  );
  return <div className="lp-marquee" aria-hidden="true"><div className="lp-marquee__track">{[row('a'), row('b')]}</div></div>;
}
