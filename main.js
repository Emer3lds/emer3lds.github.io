/* =========================================================
   emer3lds worlddddddddddddd — v2
   - emer3ld's minecraft head in 3D, drawn as a grid of little glyphs
   - it turns to follow your cursor (flick fast and it spins)
   - stars rush past; hold to warp
   - every so often (or when you click) it fires rainbow lasers from its eyes
   ========================================================= */
import * as THREE from "three";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W = innerWidth, H = innerHeight;

function fit2d(canvas) {
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return ctx;
}

/* ---------------- pointer / hold-to-warp / click-to-fire ---------------- */
const pointer = { x: W / 2, y: H / 2, active: false, vx: 0, lastMove: 0 };
let holding = false, holdStart = 0, warp = 1;

addEventListener("pointermove", (e) => {
  const now = performance.now();
  const dt = Math.max(1, now - pointer.lastMove);
  pointer.vx = (e.clientX - pointer.x) / dt; // px per ms
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.active = true; pointer.lastMove = now;
});
addEventListener("pointerdown", (e) => {
  if (e.target.closest("a")) return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.lastMove = performance.now();
  holding = true; holdStart = performance.now();
});
addEventListener("pointerup", (e) => {
  if (!holding) return;
  holding = false;
  if (performance.now() - holdStart < 250) fireLasers(); // a quick click fires
});
document.addEventListener("pointerleave", () => { pointer.active = false; holding = false; });

/* =========================================================
   1. stars rushing past
   ========================================================= */
const starCanvas = document.getElementById("stars");
let sctx = fit2d(starCanvas);
const STAR_COUNT = 650;
const stars = Array.from({ length: STAR_COUNT }, () => newStar(true));
function newStar(anyDepth) {
  return {
    x: rand(-1, 1), y: rand(-1, 1),
    z: anyDepth ? rand(0.05, 1) : 1,
    hue: Math.random() < 0.2 ? null : rand(0, 360), // some are white
    size: rand(0.6, 1.6),
  };
}
function drawStars(dt) {
  const ctx = sctx;
  ctx.fillStyle = "rgba(7, 6, 10, 0.55)"; // slight trails
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, f = Math.max(W, H) * 0.5;
  const speed = (reduceMotion ? 0.00004 : 0.00016) * warp;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const s of stars) {
    const pz = s.z;
    s.z -= speed * dt;
    if (s.z <= 0.02) { Object.assign(s, newStar(false)); continue; }
    const x1 = cx + (s.x / s.z) * f, y1 = cy + (s.y / s.z) * f;
    const tail = Math.min(pz + speed * 60 * (0.6 + warp * 0.5), 1.2);
    const x0 = cx + (s.x / tail) * f, y0 = cy + (s.y / tail) * f;
    if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) { Object.assign(s, newStar(false)); continue; }
    const near = 1 - s.z;
    const w = s.size * (0.5 + near * 2.4);
    const a = Math.min(1, near * 1.4);
    const col = s.hue === null ? `rgba(255,255,255,${a})` : `hsla(${s.hue},100%,65%,${a})`;
    // chromatic split: a red and a cyan ghost either side of the streak
    ctx.lineWidth = w;
    ctx.strokeStyle = `rgba(255,40,90,${a * 0.5})`;
    ctx.beginPath(); ctx.moveTo(x0 + 1.5, y0); ctx.lineTo(x1 + 1.5, y1); ctx.stroke();
    ctx.strokeStyle = `rgba(40,220,255,${a * 0.5})`;
    ctx.beginPath(); ctx.moveTo(x0 - 1.5, y0); ctx.lineTo(x1 - 1.5, y1); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    // little square head on the comet
    ctx.fillStyle = col;
    ctx.fillRect(x1 - w, y1 - w, w * 2, w * 2);
  }
  ctx.globalCompositeOperation = "source-over";
}

/* =========================================================
   2. the head (three.js, rendered tiny, then redrawn as glyphs)
   ========================================================= */
const headCanvas = document.getElementById("head");
let hctx = fit2d(headCanvas);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 1000);
camera.position.set(0, 0, 60);
const head = new THREE.Group();
scene.add(head);

let cell = 12, cols = 1, rows = 1, rt = null, pixels = null, headScale = 1;

function layout() {
  // cell size scales with the screen so the head is always ~40 glyphs wide
  cell = clamp(Math.round(Math.min(W, H) / 62), 7, 18);
  cols = Math.ceil(W / cell);
  rows = Math.ceil(H / cell);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  rt?.dispose();
  rt = new THREE.WebGLRenderTarget(cols, rows, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  pixels = new Uint8Array(cols * rows * 4);
  renderer.setSize(cols, rows, false);
  // make the head big but always fully on screen (even mid-spin)
  const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visW = visH * camera.aspect;
  headScale = (Math.min(visH, visW) * 0.4) / 8;
  head.scale.setScalar(headScale);
}

/* skin loading — always your current skin */
const SKIN_FALLBACK = "https://textures.minecraft.net/texture/c4566214036a2e2a56e2d9aa10c8d03bff05ad54598351c8b33e013ffd2a0c57";
async function loadSkin() {
  let url = SKIN_FALLBACK;
  try {
    const res = await fetch("https://playerdb.co/api/player/minecraft/emer3ld");
    const p = (await res.json()).data.player;
    const prop = p.properties.find((x) => x.name === "textures");
    url = JSON.parse(atob(prop.value)).textures.SKIN.url.replace("http://", "https://");
  } catch (e) { /* fallback */ }
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

function faceTex(img, sx, sy) {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  c.getContext("2d").drawImage(img, sx, sy, 8, 8, 0, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// a bit of fake lighting per side so it reads as 3D
const SHADE = { px: 0.78, nx: 0.78, py: 1.0, ny: 0.55, pz: 0.96, nz: 0.7 };
function buildHead(img) {
  // box face order: +x, -x, +y, -y, +z, -z
  // minecraft head: right side (0,8) faces -x, left side (16,8) faces +x
  const base = [[16, 8, "px"], [0, 8, "nx"], [8, 0, "py"], [16, 0, "ny"], [8, 8, "pz"], [24, 8, "nz"]];
  const mats = (offset, overlay) => base.map(([sx, sy, k]) => new THREE.MeshBasicMaterial({
    map: faceTex(img, sx + offset, sy),
    color: new THREE.Color().setScalar(SHADE[k]),
    transparent: overlay,
    alphaTest: overlay ? 0.5 : 0,
  }));
  head.add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), mats(0, false)));
  head.add(new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), mats(32, true))); // hat layer
}

/* follow the cursor with a springy, slightly over-excited turn */
const rot = { x: 0, y: 0, vx: 0, vy: 0 };
let spinKick = 0;
function updateHead(t, dt) {
  const s = dt / 1000;
  let tx = 0, ty = 0;
  const idle = !pointer.active || t - pointer.lastMove > 4000;
  if (!idle) {
    const nx = (pointer.x / W) * 2 - 1, ny = (pointer.y / H) * 2 - 1;
    ty = nx * 0.95;
    tx = ny * 0.62;
  } else {
    ty = Math.sin(t * 0.0005) * 0.5;
    tx = Math.sin(t * 0.0007) * 0.18;
  }
  // flick the mouse fast sideways → the head spins
  if (!reduceMotion && Math.abs(pointer.vx) > 2.2 && t - pointer.lastMove < 40) {
    rot.vy += Math.sign(pointer.vx) * Math.min(Math.abs(pointer.vx), 6) * 3.2;
    pointer.vx = 0;
  }
  // unwind full turns so it keeps spinning forward instead of reversing
  while (rot.y - ty > Math.PI) rot.y -= Math.PI * 2;
  while (rot.y - ty < -Math.PI) rot.y += Math.PI * 2;
  const k = 48, damp = 7.5;
  rot.vy += ((ty - rot.y) * k - rot.vy * damp) * s;
  rot.vx += ((tx - rot.x) * k - rot.vx * damp) * s;
  rot.y += rot.vy * s;
  rot.x += rot.vx * s;
  head.rotation.set(rot.x, rot.y, Math.sin(t * 0.0011) * 0.04);
  head.position.y = Math.sin(t * 0.0016) * 0.6;
  // recoil while firing
  head.position.z = laser.firing ? -1.5 : 0;
}

/* glyph shapes, picked by brightness — with a 4x4 bayer pattern so bands break up like dither */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5) * 0.18);
function drawGlyphs(t) {
  const ctx = hctx;
  ctx.clearRect(0, 0, W, H);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(rt, 0, 0, cols, rows, pixels);
  renderer.setRenderTarget(null);

  const g = cell, pad = Math.max(1, Math.round(g * 0.12)), inner = g - pad * 2;
  const shake = laser.firing && !reduceMotion ? rand(-1.5, 1.5) : 0;
  ctx.lineWidth = Math.max(1, g * 0.12);
  for (let row = 0; row < rows; row++) {
    const y = (rows - 1 - row) * g + shake; // pixels come back bottom-up
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4;
      if (pixels[i + 3] < 128) continue;
      let r = pixels[i], gr = pixels[i + 1], b = pixels[i + 2];
      const x = col * g + shake;
      const lum = (0.299 * r + 0.587 * gr + 0.114 * b) / 255 + BAYER[(row & 3) * 4 + (col & 3)];
      // lift very dark pixels a bit so they still show on black
      if (lum < 0.12) { r = Math.max(r, 70); gr = Math.max(gr, 62); b = Math.max(b, 90); }
      const color = `rgb(${r},${gr},${b})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (lum > 0.62) {
        ctx.fillRect(x + pad, y + pad, inner, inner);                       // ■
      } else if (lum > 0.46) {
        ctx.beginPath(); ctx.arc(x + g / 2, y + g / 2, inner * 0.45, 0, Math.PI * 2); ctx.fill(); // ●
      } else if (lum > 0.3) {
        ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, inner - 1, inner - 1);  // □
      } else {
        const m = g / 2, a = inner * 0.42;                                  // +
        ctx.beginPath();
        ctx.moveTo(x + m - a, y + m); ctx.lineTo(x + m + a, y + m);
        ctx.moveTo(x + m, y + m - a); ctx.lineTo(x + m, y + m + a);
        ctx.stroke();
      }
    }
  }
}

/* =========================================================
   3. rainbow eye lasers
   ========================================================= */
const fxCanvas = document.getElementById("fx");
let fctx = fit2d(fxCanvas);
// eye centers on the face, in head units (the head is 8 wide, centered on 0)
const EYES = [new THREE.Vector3(-2.5, -0.5, 4.6), new THREE.Vector3(2.5, -0.5, 4.6)];
const laser = { start: -1e9, firing: false, charging: false, target: { x: 0, y: 0 } };
const CHARGE = 450, FIRE = 1400;
let sparks = [];
let nextAuto = performance.now() + rand(4000, 6000);

function fireLasers() {
  const now = performance.now();
  if (now - laser.start < CHARGE + FIRE) return;
  laser.start = now;
  nextAuto = now + rand(7000, 12000);
  const old = document.title;
  document.title = "PEW PEW";
  setTimeout(() => (document.title = old), 1600);
}

function eyeScreen(v) {
  const p = v.clone();
  head.localToWorld(p);
  p.project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
}

function drawLasers(t, dt) {
  const ctx = fctx;
  ctx.clearRect(0, 0, W, H);
  const age = t - laser.start;
  laser.charging = age >= 0 && age < CHARGE;
  laser.firing = age >= CHARGE && age < CHARGE + FIRE;
  const eyes = EYES.map(eyeScreen);

  if (laser.charging || laser.firing) {
    // where do the beams go? toward the cursor if there is one, else straight out of the face
    let tx, ty;
    if (pointer.active && Math.hypot(pointer.x - W / 2, pointer.y - H / 2) > 30) {
      tx = pointer.x; ty = pointer.y;
    } else {
      const mid = { x: (eyes[0].x + eyes[1].x) / 2, y: (eyes[0].y + eyes[1].y) / 2 };
      const fwd = new THREE.Vector3(0, -0.5, 30); head.localToWorld(fwd); fwd.project(camera);
      tx = (fwd.x * 0.5 + 0.5) * W; ty = (-fwd.y * 0.5 + 0.5) * H;
      if (Math.hypot(tx - mid.x, ty - mid.y) < 20) { tx = mid.x + 1; ty = H + 100; }
    }
    laser.target = { x: tx, y: ty };
    ctx.globalCompositeOperation = "lighter";
    for (const [n, e] of eyes.entries()) {
      // charge-up glow
      const glow = laser.charging ? age / CHARGE : 1;
      const rg = cell * (1.2 + glow * 2.2) * (laser.firing ? 1 + Math.sin(t * 0.06) * 0.15 : 1);
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rg);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, `hsla(${(t * 0.4 + n * 180) % 360},100%,65%,0.7)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(e.x, e.y, rg, 0, Math.PI * 2); ctx.fill();
      if (!laser.firing) continue;

      // beam: from the eye, through the target, out to the edge of the screen
      const fireAge = age - CHARGE;
      const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const reach = Math.min(1, fireAge / 140) * Math.hypot(W, H) * 1.2;
      const ex = e.x + ux * reach, ey = e.y + uy * reach;
      const fade = fireAge > FIRE - 300 ? (FIRE - fireAge) / 300 : 1;
      const width = cell * (0.9 + Math.sin(t * 0.08 + n) * 0.25) * fade;
      const nxp = -uy, nyp = ux; // perpendicular
      // six rainbow bands side by side, hues sliding over time
      for (let b = 0; b < 6; b++) {
        const off = (b - 2.5) * width * 0.38;
        ctx.strokeStyle = `hsla(${(t * 0.5 + b * 60) % 360},100%,60%,${0.75 * fade})`;
        ctx.lineWidth = width * 0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(e.x + nxp * off, e.y + nyp * off);
        ctx.lineTo(ex + nxp * off * 2.2, ey + nyp * off * 2.2);
        ctx.stroke();
      }
      // white-hot core
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * fade})`;
      ctx.lineWidth = width * 0.35;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(ex, ey); ctx.stroke();
      // glyph squares riding along the beam
      const step = cell * 1.6;
      for (let d = (fireAge * 0.9) % step; d < reach; d += step) {
        const px = e.x + ux * d, py = e.y + uy * d;
        ctx.fillStyle = `hsla(${(d * 0.6 - t * 0.6) % 360},100%,70%,${0.9 * fade})`;
        const sz = cell * 0.7;
        ctx.fillRect(Math.round(px / cell) * cell + (cell - sz) / 2, Math.round(py / cell) * cell + (cell - sz) / 2, sz, sz);
      }
      // sparks where it hits the cursor
      if (pointer.active && !reduceMotion && Math.random() < 0.6) {
        for (let k = 0; k < 2; k++) sparks.push({ x: tx, y: ty, vx: rand(-0.5, 0.5), vy: rand(-0.6, 0.3), life: 1, hue: rand(0, 360) });
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // sparks
  ctx.globalCompositeOperation = "lighter";
  for (const s of sparks) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.0012 * dt; s.life -= dt / 600;
    ctx.fillStyle = `hsla(${s.hue},100%,65%,${Math.max(0, s.life)})`;
    const sz = cell * 0.5 * s.life;
    ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
  }
  ctx.globalCompositeOperation = "source-over";
  sparks = sparks.filter((s) => s.life > 0);
}

/* =========================================================
   HUD: warp speed
   ========================================================= */
const speedEl = document.getElementById("speed");
function updateHud() {
  speedEl.textContent = `${warp.toFixed(2)}x`;
}

/* =========================================================
   main loop
   ========================================================= */
let last = performance.now();
let ready = false;
function frame(t) {
  tick(t);
  requestAnimationFrame(frame);
}
function tick(t) {
  const dt = Math.min(50, t - last);
  last = t;
  // hold anywhere to warp
  const targetWarp = holding && t - holdStart > 250 ? 6 : 1;
  warp += (targetWarp - warp) * (1 - Math.exp(-dt * 0.004));

  drawStars(dt);
  if (ready) {
    updateHead(t, dt);
    if (!reduceMotion && t > nextAuto) fireLasers();
    drawGlyphs(t);
    drawLasers(t, dt);
  }
  updateHud(t);
}

addEventListener("resize", () => {
  W = innerWidth; H = innerHeight;
  sctx = fit2d(starCanvas); hctx = fit2d(headCanvas); fctx = fit2d(fxCanvas);
  layout();
});

layout();
requestAnimationFrame(frame);
loadSkin().then((img) => { buildHead(img); ready = true; });
