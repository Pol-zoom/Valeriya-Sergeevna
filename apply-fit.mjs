// Автоподгон длинных текстов. Запуск из корня проекта:  node apply-fit.mjs
// Правит src/App.jsx и src/styles.css, делает копии *.bak. Если что-то не нашлось — ничего не меняет.
import fs from "fs";
const appP = "src/App.jsx", cssP = "src/styles.css";
let app = fs.readFileSync(appP, "utf8"), css = fs.readFileSync(cssP, "utf8");
if (app.includes("function Fit(")) { console.log("Уже применено — ничего не делаю."); process.exit(0); }

const FIT = `// Автоподгон: если текст длиннее, чем помещается на экране, шрифт сам уменьшается, пока всё не влезет
function Fit({ children, className = "", style, dep }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollHeight > el.clientHeight + 1 && size > 10) { size -= 0.5; el.style.fontSize = size + "px"; }
    };
    fit();
    window.addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, [dep]);
  return <div ref={ref} className={"fit " + className} style={style}>{children}</div>;
}
`;
const steps = [
  ['import { useEffect, useRef, useState } from "react";', 'import { useEffect, useLayoutEffect, useRef, useState } from "react";'],
  ['const rp =', FIT + 'const rp ='],
  ['<p>{l.text}</p><footer>— {l.from}</footer>', '<Fit className="lt"><p>{l.text}</p><footer>— {l.from}</footer></Fit>'],
  ['<div className="lines">{greeting.map(', '<Fit className="lines">{greeting.map('],
  ['</p>)}</div>\n        <Heart', '</p>)}</Fit>\n        <Heart'],
  ['<p className="story rv" style={T(1, PT[0] + 2)}>', '<Fit className="story rv" style={T(1, PT[0] + 2)} dep={open}>'],
  ['{photos[open].story}</p>', '{photos[open].story}</Fit>'],
];
for (const [a, b] of steps) {
  if (!app.includes(a)) { console.error("НЕ НАЙДЕНО в App.jsx:\n" + a + "\nНичего не изменено. Пришлите мне App.jsx."); process.exit(1); }
  app = app.replace(a, () => b);
}
css += `
/* автоподгон текста */
.fit{overflow:hidden;max-height:var(--maxh,none)}
.fit.lt{--maxh:calc(100svh - 116px - clamp(150px,26svh,240px) - 140px);font-family:var(--hand);font-size:clamp(21px,2vw,27px);line-height:1.25}
.letter p{font-size:1em}
.fit.lines{--maxh:calc(100svh - 116px - clamp(150px,26svh,240px) - 240px)}
.fit.story{--maxh:16svh}
@media(max-width:820px){.fit.lt{--maxh:calc((100svh - 112px - clamp(150px,28svh,230px) - 210px) / 3)}}
`;
fs.copyFileSync(appP, appP + ".bak"); fs.copyFileSync(cssP, cssP + ".bak");
fs.writeFileSync(appP, app); fs.writeFileSync(cssP, css);
console.log("Готово: письма, поздравление и подписи к фото теперь сами уменьшают шрифт, если текст не влезает.");
