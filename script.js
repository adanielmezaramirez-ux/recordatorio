const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- Nubes ----------
const clouds = document.getElementById('clouds');
for (let i = 0; i < 9; i++) {
  const c = document.createElement('div');
  c.className = 'cloud';
  const w = rnd(110, 280) * Math.max(1, innerWidth / 1300); // más grandes en pantallas grandes
  const speed = rnd(40, 90) * (w < 170 ? 1.4 : 1); // las pequeñas (lejanas) van más lento
  c.style.width = w + 'px';
  c.style.height = w * 0.28 + 'px';
  c.style.top = rnd(4, 88) + 'vh';
  c.style.animationDuration = speed + 's';
  c.style.animationDelay = -rnd(0, speed) + 's';
  c.style.setProperty('--rx', rnd(0, 90) + 'vw');
  clouds.appendChild(c);
}

// ---------- Estrellas (se ven al anochecer) ----------
const stars = document.getElementById('stars');
for (let i = 0; i < 70; i++) {
  const s = document.createElement('i');
  const sz = rnd(1.5, 3.5);
  s.style.left = rnd(0, 100) + '%';
  s.style.top = rnd(0, 85) + '%';
  s.style.width = s.style.height = sz + 'px';
  s.style.animationDelay = -rnd(0, 3) + 's';
  stars.appendChild(s);
}

// ---------- Cielo según el avance: día -> atardecer -> noche ----------
const PAL = [
  { t: [74, 168, 240], b: [217, 241, 255] },   // día
  { t: [98, 78, 160],  b: [255, 160, 125] },   // atardecer
  { t: [10, 16, 48],   b: [42, 50, 112] },     // noche
];
const mix = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

const bar = document.getElementById('progress');
function update() {
  const max = root.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  bar.style.width = p * 100 + '%';

  // el avión de atrás aparece al salir de la portada
  const h = innerHeight;
  root.style.setProperty('--ferry', Math.min(1, Math.max(0, (scrollY - h * 0.55) / (h * 0.4))));

  const seg = p * 2;                          // 0..2
  const i = Math.min(1, Math.floor(seg));
  const f = seg - i;
  root.style.setProperty('--sky-top', rgb(mix(PAL[i].t, PAL[i + 1].t, f)));
  root.style.setProperty('--sky-bot', rgb(mix(PAL[i].b, PAL[i + 1].b, f)));
  root.style.setProperty('--night', Math.max(0, seg - 0.6) / 1.4);
}
addEventListener('scroll', update, { passive: true });
addEventListener('resize', update);
update();

// ---------- Cada parte aparece al llegar ----------
const parts = document.querySelectorAll('.paper');
if (reduce) parts.forEach((p) => p.classList.add('visible'));
else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.25 });
  parts.forEach((p) => io.observe(p));
}

// ---------- Avión de atrás: ruta en zigzag, a veces por delante de las hojas ----------
// Al llegar al final de la página pasa por el espacio vacío de abajo.
const ferry = document.getElementById('ferry');
const move = ferry.querySelector('.ferry-move');
const ferryPlane = ferry.querySelector('.plane');
const lastPaper = parts[parts.length - 1];
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ROWS = [[0.12, 0.36], [0.5, 0.76]];   // [y inicial, y final] en fracción de pantalla
const PASS_MS = () => 3600 + Math.random() * 800;
const PAUSE_MS = 800;

if (reduce) {
  move.style.transform = `translate(${innerWidth * 0.2}px, ${innerHeight * 0.6}px)`;
} else {
  let dir = 1, row = 0, front = false;
  let passStart = performance.now(), passDur = PASS_MS(), pausing = false;
  let ySm = null, last = passStart;

  const atBottom = () => root.scrollHeight - innerHeight - scrollY < 160;

  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const fw = move.offsetWidth, fh = move.offsetHeight;
    const margin = innerWidth * 0.04;
    const xL = -(fw + margin), xR = innerWidth + margin;

    // progreso del cruce actual (o pausa fuera de pantalla)
    let t = (now - passStart) / passDur;
    if (!pausing && t >= 1) { pausing = true; passStart = now; passDur = PAUSE_MS; t = 0; }
    else if (pausing && t >= 1) {
      pausing = false; dir = -dir; row = (row + 1) % ROWS.length;
      front = Math.random() < 0.4;                       // no siempre pasa por delante
      ferry.style.zIndex = front ? 2 : 0;
      ferryPlane.style.setProperty('--flip', dir === 1 ? '0deg' : '180deg');
      passStart = now; passDur = PASS_MS(); t = 0;
    }
    const k = pausing ? 1 : ease(Math.min(1, t));
    const from = dir === 1 ? xL : xR, to = dir === 1 ? xR : xL;
    const x = pausing ? to : from + (to - from) * k;

    // altura objetivo: zigzag, o el hueco bajo la última hoja si estamos hasta abajo
    const low = atBottom();
    let target;
    if (low) {
      const top = lastPaper.getBoundingClientRect().bottom;
      target = top + Math.max(0, (innerHeight - top - fh) / 2);
    } else {
      const [a, b] = ROWS[row];
      target = (pausing ? b : a + (b - a) * k) * innerHeight;
    }
    ySm = ySm === null ? target : ySm + (target - ySm) * (1 - Math.exp(-dt * 4));
    ferry.style.setProperty('--amp', low ? '1.2vh' : '4vh');
    move.style.transform = `translate(${x}px, ${ySm}px)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
