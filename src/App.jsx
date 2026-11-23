import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Howl } from "howler";
import Lenis from "lenis";
import gsap from "gsap";
import confetti from "canvas-confetti";
import Tilt from "react-parallax-tilt";
import { Play, Pause, Heart, ArrowDown } from "lucide-react";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/caveat/500.css";
import "@fontsource/comfortaa/700.css";
import Scene3D from "./Scene3D.jsx";
import map from "./audio/nit-map.json";
import { NAME, photos, letters, greeting, crew, PHRASES, LINES, LINE_TIMES } from "./data";
import "./styles.css";

// Границы частей трека (сек) — найдены анализом nit.mp3. Можно подправить вручную.
const CUTS = [0, ...map.cuts, map.duration];
const CHAPTERS = ["Пролог", "Фотки", "Наши слова", "Поздравление", "The end"];
const K = 55; // px прокрутки на 1 секунду трека: скорость постоянна все 4:39
// T(сцена, секунда трека, длительность появления) -> CSS-переменные момента
const T = (i, sec, d = 1.5) => ({ "--s": ((sec - CUTS[i]) / (CUTS[i + 1] - CUTS[i])).toFixed(4), "--d": (d / (CUTS[i + 1] - CUTS[i])).toFixed(4) });
const PT = photos.map((_, i) => CUTS[1] + 4 + i * (62 / photos.length)); // моменты фото
const LT = letters.map((_, i) => CUTS[2] + 2 + i * (40 / letters.length)); // моменты писем
// события-кульминации: [время сек, вспышка, конфетти]
const EVT = [[CUTS[1], 0.8, 14], [CUTS[2], 1.2, 60], [CUTS[3], 0.7, 0], [CUTS[4], 2.2, 200], [CUTS[4] + 18, 0.9, 50], [CUTS[4] + 36, 1, 60], [map.duration - 9, 1.8, 110]];
const Chars = ({ i, sec, text, step = 0.07 }) => [...text].map((ch, k) => <span key={k} className="ch rv" style={T(i, sec + k * step, 0.9)}>{ch}</span>);
const mix = (x, y, k) => x.map((v, i) => Math.round(v + (y[i] - v) * k));
// строки песни: [секунда, текст, сколько висит]
const LYRICS = LINES.map((t, i) => [LINE_TIMES[i], t, Math.min(9, (LINE_TIMES[i + 1] ?? LINE_TIMES[i] + 7) - LINE_TIMES[i] + 1.5)]);
const MARK = /(\[[pia]:[^\]]+\]|красная нить|сердцами|навсегда|вместе|мечтою|семьёй|снежный десант|судьбы|судьбой)/gi;
const Line = ({ text }) => text.split(MARK).map((p, k) => (k % 2 ? (p[0] === "[" ? <span key={k} className={p[1]}>{p.slice(3, -1)}</span> : /красная нить/i.test(p) ? <b key={k} className="rt">{p}</b> : <u key={k}>{p}</u>) : p));
const SYNC = typeof location !== "undefined" && location.search.includes("sync");
const SLOT = [0, 3, 4, 1, 2, 5]; // соседние строки всегда в разных местах экрана

// Фото: если файла нет или он не открылся — вместо значка ошибки остаётся красивая заглушка
function Photo({ src, alt, n }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt={alt} onError={() => setBad(true)} /> : <span>ФОТО {n}</span>;
}

// Автоподгон: если текст длиннее, чем помещается на экране, шрифт сам уменьшается, пока всё не влезет
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
const rp = (i, a) => { const x = Math.sin((i + 1) * a) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export default function App() {
  const root = useRef(null);
  const sceneEls = useRef([]);
  const st = useRef({ follow: false, playing: false });
  const sound = useRef(null);
  const lenis = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [follow, setFollow] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [open, setOpen] = useState(0);
  const [cap, setCap] = useState("");
  const [done, setDone] = useState(false);
  const [words, setWords] = useState([]);
  const [tap, setTap] = useState([]);
  const tc = useRef(null), boom = useRef(null), live = useRef({ g: 0, pulse: 0, kick: 0, flash: 0, red: 0, te: 0 });

  useEffect(() => {
    sound.current = new Howl({ src: [import.meta.env.BASE_URL + "audio/nit.mp3"], html5: true, onend: () => { setPlaying(false); setDone(true); } });
    const onKey = (e) => {
      if (!SYNC) return;
      if (e.code === "Space") { e.preventDefault(); setTap((x) => (x.length < LINES.length ? [...x, +sound.current.seek().toFixed(1)] : x)); }
      if (e.code === "Backspace") setTap((x) => x.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    const l = (lenis.current = new Lenis({ lerp: 0.12 }));
    const free = () => { if (st.current.follow) { st.current.follow = false; setFollow(false); } };
    ["wheel", "touchmove", "keydown"].forEach((e) => window.addEventListener(e, free, { passive: true }));

    boom.current = (fl, cn) => {
      gsap.fromTo(live.current, { flash: fl }, { flash: 0, duration: 3, ease: "power2.out" });
      if (cn) [0.15, 0.85].forEach((x) => confetti({ particleCount: cn / 2, spread: 90, angle: x < 0.5 ? 60 : 120, origin: { x, y: 0.75 }, startVelocity: 55, colors: ["#8e5bd1", "#c9b2ee", "#e0314f", "#7a4f35", "#f3ece4", "#ffffff"], ticks: 280, scalar: 1.1 }));
    };
    let raf, lastCh = -1, smooth = 0;
    const tick = (now) => {
      l.raf(now);
      const s = sound.current, el = root.current;
      const t = s.playing() ? s.seek() : (st.current.t ?? 0);
      st.current.t = t;
      const tops = sceneEls.current.map((e) => e.offsetTop), hs = sceneEls.current.map((e) => e.offsetHeight);
      const vh = window.innerHeight;
      if (st.current.follow && s.playing()) {
        const i = Math.max(0, CUTS.findIndex((c, k) => t >= c && t < CUTS[k + 1]));
        const f = (t - CUTS[i]) / (CUTS[i + 1] - CUTS[i]);
        l.scrollTo(tops[i] + f * (hs[i] - vh), { immediate: true });
      }
      const y = window.scrollY;
      const ci = Math.max(0, tops.findLastIndex((tp) => y >= tp));
      const te = CUTS[ci] + clamp((y - tops[ci]) / (hs[ci] - vh)) * (CUTS[ci + 1] - CUTS[ci]);
      const o = Math.max(0, PT.findLastIndex((x) => te >= x));
      if (o !== st.current.open) { st.current.open = o; setOpen(o); }
      const act = LYRICS.flatMap((w, i) => (te >= w[0] && te < w[0] + w[2] ? [i] : []));
      const wk = act.join(",");
      if (wk !== st.current.wk) {
        if (s.playing() && act.some((i) => /красная нить/i.test(LYRICS[i][1]) && !(st.current.act || []).includes(i))) live.current.kick = 1;
        st.current.wk = wk; st.current.act = act; setWords(act.slice(-2));
      }
      const dn = te >= map.duration - 5; if (dn !== st.current.dn) { st.current.dn = dn; setDone(dn); }
      const ph = PHRASES[ci], pi = Math.min(ph.length - 1, Math.floor(((te - CUTS[ci]) / (CUTS[ci + 1] - CUTS[ci])) * ph.length));
      if (ci * 100 + pi !== st.current.cap) { st.current.cap = ci * 100 + pi; setCap(ph[pi]); }
      tc.current.textContent = `ДЕНЬ ${Math.min(21, 1 + Math.floor((te / map.duration) * 21))} / 21 · НИТЕЙ ${Math.min(44, 1 + Math.floor(te / 0.85))} / 44 · ${Math.floor(te / 60)}:${String(Math.floor(te % 60)).padStart(2, "0")}`;
      sceneEls.current.forEach((e, i) => e.style.setProperty("--p", clamp((y - tops[i]) / (hs[i] - vh)).toFixed(4)));
      const g = clamp(y / (document.documentElement.scrollHeight - vh));
      const raw = (map.env[Math.floor(t * 10)] ?? 0) / 255;
      smooth += (raw - smooth) * 0.25;
      el.style.setProperty("--g", g.toFixed(4));
      el.style.setProperty("--pulse", s.playing() ? smooth.toFixed(3) : "0");
      el.style.setProperty("--t", (t / map.duration).toFixed(4));
      const L = live.current, dr = raw - (st.current.prev ?? 0); st.current.prev = raw;
      if (s.playing() && dr > 0.12) L.kick = 1;
      L.kick *= 0.9; L.g = g;
      L.te = te;
      L.red = clamp((te - CUTS[4]) / 8); // последний припев: нить становится красной
      el.style.setProperty("--red", `rgb(${mix([142, 91, 209], [224, 49, 79], L.red)})`);
      el.style.setProperty("--rose", `rgb(${mix([201, 178, 238], [255, 154, 168], L.red)})`); L.pulse = s.playing() ? smooth : 0;
      if (s.playing()) { const lt = st.current.lt ?? t; EVT.forEach(([et, fl, cn]) => { if (lt < et && t >= et) boom.current(fl, cn); }); }
      st.current.lt = t;
      const ch = Math.max(0, tops.findLastIndex((tp) => y >= tp - vh / 2));
      if (ch !== lastCh) { lastCh = ch; setChapter(ch); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); l.destroy(); sound.current.unload(); window.removeEventListener("keydown", onKey); ["wheel", "touchmove", "keydown"].forEach((e) => window.removeEventListener(e, free)); };
  }, []);

  const toggle = () => {
    const s = sound.current;
    if (s.playing()) { s.pause(); setPlaying(false); }
    else { if (!st.current.started) { st.current.started = true; boom.current(1.8, 0); } s.play(); st.current.follow = true; setFollow(true); setPlaying(true); }
  };
  const goChapter = (i) => {
    const s = sound.current, top = sceneEls.current[i].offsetTop;
    if (s.playing() || st.current.follow) { s.seek(CUTS[i] + 0.1); st.current.follow = true; setFollow(true); }
    lenis.current.scrollTo(top, { duration: 1.4 });
  };
  const replay = () => {
    setDone(false); st.current.dn = false; st.current.lt = 0; st.current.follow = true; setFollow(true);
    lenis.current.scrollTo(0, { immediate: true }); sound.current.seek(0); sound.current.play(); setPlaying(true);
  };
  const resync = () => { st.current.follow = true; setFollow(true); };
  const sc = (i) => ({ ref: (el) => (sceneEls.current[i] = el), style: { height: `calc(100svh + ${(CUTS[i + 1] - CUTS[i]) * K}px)` } });

  return (
    <main ref={root} className="site">
      <div className="grain" /><div className="vignette" />
      <Scene3D live={live} />
      <div className="words" aria-hidden>
        {words.map((i) => { const [, txt, dur] = LYRICS[i]; return <span key={i} className={`w s${SLOT[i % 6]}`} style={{ "--dur": `${dur}s` }}><Line text={txt} /></span>; })}
      </div>

      <header className="bar">
        <button className="round" onClick={toggle} aria-label={playing ? "Пауза" : "Играть"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <nav>{CHAPTERS.map((c, i) => <button key={c} className={i === chapter ? "on" : ""} onClick={() => goChapter(i)}><i>0{i + 1}</i><span>{c}</span></button>)}</nav>
        <span ref={tc} className="tc">0:00</span>
        <div className="prog"><b style={{ transform: "scaleX(var(--t))" }} /></div>
      </header>
      {playing && !follow && <button className="resync" onClick={resync}>↺ вернуться к музыке</button>}

      {SYNC && (
        <div className="syncbox" onPointerDown={(e) => { if (e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") setTap((x) => (x.length < LINES.length ? [...x, +sound.current.seek().toFixed(1)] : x)); }}>
          <p>РАЗМЕТКА: запустите музыку и нажимайте Пробел (или касание) в момент, когда начинается строка. Backspace — отменить.</p>
          <h3>{tap.length < LINES.length ? `${tap.length + 1}/${LINES.length}: ${LINES[tap.length].replace(/\[.:|\]/g, "")}` : "Готово! Скопируйте и отправьте мне или вставьте в data.js"}</h3>
          {tap.length === LINES.length && <textarea readOnly value={`export const LINE_TIMES = ${JSON.stringify(tap)};`} onFocus={(e) => e.target.select()} />}
        </div>
      )}
      <div className="cap" key={cap}>{cap}</div>

      {/* 01 ПРОЛОГ 0:00–1:11 */}
      <section {...sc(0)} className="scene"><div className="stage center">
        {!playing && <button className="start" onClick={toggle}><Play size={18} />Запуск</button>}
        <p className="kicker rv" style={T(0, 3)}>Одна история · много сердец</p>
        <h1><span><Chars i={0} sec={8} text="Есть вещи," /></span><span><Chars i={0} sec={20} text="которые связывают" step={0.1} /></span><span className="acc"><Chars i={0} sec={34} text="нас навсегда." step={0.14} /></span></h1>
        <p className="lines rv" style={T(0, 50, 3)}>О людях, не случайных встречах и трёх неделях,</p>
        <p className="lines rv" style={T(0, 60, 3)}>которые действительно запомнятся на долго.</p>
      </div></section>

      {/* 02 ВОСПОМИНАНИЯ 1:11–2:22 */}
      <section {...sc(1)} className="scene"><div className="stage">
        <h2 className="chap rv" style={T(1, CUTS[1] + 1)}>Фотки</h2>
        <div className="album">
          {photos.map((p, i) => {
            const n = photos.length;
            return (
              <figure key={i} className={"polaroid" + (open === i ? " front" : "")} onClick={() => setOpen(i)}
                style={{ ...T(1, PT[i], 3), "--rot": `${(i % 2 ? 1 : -1) * (3 + i * 2)}deg`, "--x": `${(i - (n - 1) / 2) * 9}%`, "--h": [268, 24, 280, 18][i % 4] }}>
                <Tilt tiltMaxAngleX={12} tiltMaxAngleY={12} glareEnable glareMaxOpacity={0.3} scale={1.04}>
                  <div className="ph"><Photo src={p.src} alt={p.caption} n={i + 1} /></div>
                  <figcaption style={{ minHeight: 30 }}>{p.caption}</figcaption>
                </Tilt>
                <i className="tape" />
              </figure>
            );
          })}
        </div>
        {photos[open]?.story && <Fit className="story rv" style={T(1, PT[0] + 2)} dep={open}>{photos[open].story}</Fit>}
      </div></section>

      {/* 03 СЛОВА 2:22–3:10 */}
      <section {...sc(2)} className="scene"><div className="stage">
        <h2 className="chap rv" style={T(2, CUTS[2] + 0.5)}>Люди и их слова</h2>
        <div className="letters">
          {letters.map((l, i) => (
            <article key={i} className={`letter v${i % 5} rv`} style={{ ...T(2, LT[i], 2), "--e": ((LT[i] + 12 - CUTS[2]) / (CUTS[3] - CUTS[2])).toFixed(4), "--c": (i % 3) + 1, "--tilt": `${(i % 2 ? 1 : -1) * 1.5}deg` }}>
              <Fit className="lt"><p>{l.text}</p><footer>— {l.from}</footer></Fit>
            </article>
          ))}
        </div>
      </div></section>

      {/* 04 ГЛАВНОЕ ПОЗДРАВЛЕНИЕ 3:10–3:42 (тихий бридж трека) */}
      <section {...sc(3)} className="scene"><div className="stage center">
        <p className="kicker rv" style={T(3, CUTS[3] + 1)}>только для вас</p>
        <h2 className="big rv" style={T(3, CUTS[3] + 4, 3)}>{NAME},<br /><em>это ваш день.</em></h2>
        <Fit className="lines">{greeting.map((t, i) => <p key={i} className="rv" style={T(3, CUTS[3] + 8 + i * 2.7, 1.5)}>{t}</p>)}</Fit>
        <Heart className="beat" size={30} />
      </div></section>

      {/* 05 ФИНАЛ 3:42–4:39 */}
      <section {...sc(4)} className="scene"><div className="stage center">
        <h2 className="big rv" style={T(4, CUTS[4] + 2, 3)}>Некоторые нити<br /><em>не обрываются.</em></h2>
        <ul className="crew">{crew.map((n, i) => <li key={n} className="rv" style={T(4, CUTS[4] + 10 + i * (32 / crew.length), 1.5)}>{n}</li>)}</ul>
        <p className="kicker rv" style={T(4, CUTS[4] + 44, 3)}>С любовью, ваш первый отряд отряд ♥ by Pol_zoom</p>
      </div></section>
      {done && (
        <div className="finale" onClick={() => boom.current(1, 80)}>
          <p className="kicker">с днём рождения</p>
          <h2 className="big">{NAME}</h2>
          <p className="lines">Спасибо, что вы есть. Мы всегда с вами не смотря на расстояние.</p>
          <button className="start" onClick={(e) => { e.stopPropagation(); replay(); }}>↺ Пересмотреть</button>
          <p className="hint">нажмите в любом месте — салют</p>
        </div>
      )}
      <div className="fade" />
    </main>
  );
}
