// A greeting in each language, set in different sizes like a line of type. `lang` lets screen readers pronounce them.
const hellos = [
  ['Habari', 'sw', 3.6], ['Xin chào', 'vi', 3.1], ['Hello', 'en', 2.4], ['Bonjour', 'fr', 2.8], ['こんにちは', 'ja', 2.2],
  ['Hola', 'es', 3.3], ['مرحبا', 'ar', 2.5, 'rtl'], ['Hallo', 'de', 2], ['Olá', 'pt', 2.7], ['你好', 'zh', 3],
  ['Ciao', 'it', 2.3], ['안녕하세요', 'ko', 2.1], ['नमस्ते', 'hi', 2.6], ['Merhaba', 'tr', 2.2], ['Sawubona', 'zu', 3.2],
  ['Привет', 'ru', 2.4], ['ሰላም', 'am', 2.8], ['Báwo ni', 'yo', 2.1],
];

export default function Languages() {
  return (
    <section id="languages" className="lp-languages" aria-labelledby="languages-title">
      <div className="lp-wrap">
        <div className="lp-section-head" data-reveal style={{ marginBottom: 0 }}>
          <p className="lp-kicker">Languages</p>
          <h2 id="languages-title">Say hello in forty languages</h2>
        </div>
        <ul className="lp-hellos  " aria-label="Hello in some of the languages you can practise">
          {hellos.map(([word, lang, size, dir], i) => (
            <li  key={word} data-reveal style={{ '--s': `${size}rem`, '--d': `${(i % 6) * 0.05}s` }}><span lang={lang} dir={dir} className="text-xl">{word}</span></li>
          ))}
        </ul>
        {/* <p className="lp-languages__more" data-reveal>
          Including <strong>Swahili</strong>, <strong>Vietnamese</strong>, <strong>English</strong> and <strong>French</strong>, and the Kenyan languages Kikuyu, Dholuo, Kalenjin, Luhya, Kamba and Kisii. You choose one language you speak and one you are learning.
        </p> */}
      </div>
    </section>
  );
}
