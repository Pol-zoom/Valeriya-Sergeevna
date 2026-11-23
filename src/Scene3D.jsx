import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const END = new THREE.Vector3(0, 0, -224);
const mainPts = Array.from({ length: 17 }, (_, k) => k === 16 ? END.clone() : new THREE.Vector3(Math.sin(k * 0.9) * 7 * (1 - k / 22), Math.cos(k * 0.7) * 4.5, -k * 14));

// 3D-сцена: красная нить растёт и ведёт камеру. live = { g, pulse, kick, flash } — пишет App.
export default function Scene3D({ live }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, W = () => innerWidth, H = () => innerHeight;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75)); r.setSize(W(), H());
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0e0a14); sc.fog = new THREE.FogExp2(0x0e0a14, 0.022);
    const cam = new THREE.PerspectiveCamera(62, W() / H(), 0.1, 400);
    const mk = (pts, rad, col, seg = 600, rs = 8) => { const c = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(c, seg, rad, rs, false); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, fog: false })); sc.add(m); return { c, g, m, seg, rs }; };
    const main = mk(mainPts, 0.1, 0xa070ff);
    // ещё 43 нити (всего 44): у каждой свой цвет, толщина, радиус и закрутка; обвивают главную и сходятся в узле
    const rnd = (k, a) => { const x = Math.sin((k + 1) * (a + 3.7)) * 43758.5453; return x - Math.floor(x); };
    // 43 нити + главная = 44. Каждая выходит из центра в своём направлении (золотой угол), уходит далеко в сторону и возвращается в узел.
    const PAL = [[0.74, 0.65, 0.45], [0.77, 0.7, 0.62], [0.7, 0.55, 0.35], [0.81, 0.6, 0.55], [0.72, 0.45, 0.76], [0.07, 0.5, 0.32], [0.085, 0.6, 0.47], [0.09, 0.4, 0.62], [0.08, 0.25, 0.92], [0.75, 0.15, 0.86]];
    const TH = Array.from({ length: 43 }, (_, k) => {
      const su = rnd(k, 1) * 0.04, R = 4 + rnd(k, 2) * 12, ph = k * 2.39996 + rnd(k, 3) * 0.6, tw = (rnd(k, 4) - 0.5) * 4, N = 16;
      const pts = Array.from({ length: N }, (_, j) => { const s = j / (N - 1), p = main.c.getPointAt(Math.min(1, su + (1 - su) * s)), rr = R * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 1.2), an = ph + tw * s; return new THREE.Vector3(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr * 0.7, p.z); });
      const th = mk(pts, 0.03 + rnd(k, 7) * 0.06, 0xffffff, 260, 5), c = PAL[k % PAL.length];
      th.base = new THREE.Color().setHSL(c[0] + (rnd(k, 8) - 0.5) * 0.02, c[1], Math.min(0.95, c[2] + (rnd(k, 9) - 0.5) * 0.12));
      th.red = new THREE.Color().setHSL((0.98 + rnd(k, 10) * 0.03) % 1, 0.85, 0.42 + rnd(k, 11) * 0.2);
      th.m.material.color.copy(th.base); th.su = su; th.lead = 0.22 + rnd(k, 6) * 0.2; th.k = k + 1; return th;
    });
    const draw = (t, f) => t.g.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, f)) * t.seg) * t.rs * 6);
    const V = new THREE.Color(0xa070ff), R = new THREE.Color(0xff2d4a), DV = new THREE.Color(0xc9b2ee), DR = new THREE.Color(0xff8a9a);
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.13, 180, 16, 2, 3), new THREE.MeshBasicMaterial({ color: 0xff2d4a, fog: false })); knot.position.copy(END); knot.scale.setScalar(0); sc.add(knot);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); sc.add(head);
    const n = W() < 700 ? 900 : 2200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 36; pos[i * 3 + 1] = (Math.random() - 0.5) * 20; pos[i * 3 + 2] = 20 - Math.random() * 260; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ size: 0.1, color: 0xc9b2ee, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const dust = new THREE.Points(pg, pm); sc.add(dust);
    const comp = new EffectComposer(r); comp.addPass(new RenderPass(sc, cam));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.6, 0.55, 0.12); comp.addPass(bloom); comp.addPass(new OutputPass());
    const onRes = () => { r.setSize(W(), H()); comp.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); };
    addEventListener("resize", onRes);
    let raf; const clock = new THREE.Clock();
    const loop = () => {
      const { g, pulse, kick, flash, red, te } = live.current, t = clock.getElapsedTime();
      const u = Math.min(0.9, g * 0.9), ease = u;
      draw(main, ease + 0.04); TH.forEach((h) => { draw(h, ((g + h.lead - h.su) / (1 - h.su)) * Math.max(0, Math.min(1, (te - h.k * 0.85) / 1.5))); h.m.material.color.lerpColors(h.base, h.red, red); });
      const p = main.c.getPointAt(Math.max(0, ease - 0.025)), look = main.c.getPointAt(Math.min(1, ease + 0.02));
      cam.position.set(p.x + Math.sin(t * 0.4) * 0.3, p.y + 0.4 + Math.cos(t * 0.3) * 0.2, p.z); cam.lookAt(look);
      cam.rotation.z += Math.sin(t * 0.25) * 0.05 + (Math.random() - 0.5) * kick * 0.02;
      cam.fov = 62 - kick * 6 - flash * 4; cam.updateProjectionMatrix();
      head.position.copy(main.c.getPointAt(Math.min(1, ease + 0.04))); head.scale.setScalar(1 + pulse * 0.8 + kick * 0.5);
      pm.size = 0.09 + pulse * 0.16 + kick * 0.1; dust.rotation.z = t * 0.01;
      main.m.material.color.lerpColors(V, R, red); pm.color.lerpColors(DV, DR, red);
      knot.scale.setScalar(Math.max(0, Math.min(1, (g - 0.5) * 2.5)) * 2.2 * (1 + pulse * 0.35 + kick * 0.3)); knot.rotation.set(t * 0.5, t * 0.7, 0);
      bloom.strength = 0.55 + pulse * 0.6 + kick * 0.5 + flash * 1.1 + red * 0.25;
      comp.render(); raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onRes); comp.dispose?.(); r.dispose(); };
  }, [live]);
  return <canvas ref={ref} className="scene3d" />;
}
