/* =========================================================
   emer3lds worlddddddddddddd
   classic video-site page with niconico-style 弾幕 inside the player.
   letters slip away from your cursor.
   ========================================================= */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------- video screen: your own picture if present ---------------- */
const screen = document.getElementById("screen");
const screenArt = document.getElementById("screenArt");
if (screenArt.complete && screenArt.naturalWidth) screen.classList.add("has-art");
screenArt.addEventListener("load", () => screen.classList.add("has-art"));

/* ---------------- emer3ld's minecraft skin ----------------
   we load the real skin file and draw it ourselves, so it's always your current skin.
   (falls back to the skin as of nov 2026 if the lookup service is down) */
const SKIN_FALLBACK = "https://textures.minecraft.net/texture/c4566214036a2e2a56e2d9aa10c8d03bff05ad54598351c8b33e013ffd2a0c57";
const skin = { img: null, slim: false };

async function loadSkin() {
  let url = SKIN_FALLBACK;
  try {
    const res = await fetch("https://playerdb.co/api/player/minecraft/emer3ld");
    const p = (await res.json()).data.player;
    const prop = p.properties.find((x) => x.name === "textures");
    const tex = JSON.parse(atob(prop.value)).textures.SKIN;
    url = tex.url.replace("http://", "https://");
    skin.slim = tex.metadata?.model === "slim";
  } catch (e) { /* use fallback */ }
  const img = new Image();
  img.src = url;
  await img.decode();
  skin.img = img;
  drawFaces();
}

function drawFaces() {
  for (const c of document.querySelectorAll("canvas.face")) {
    const fctx = c.getContext("2d");
    fctx.imageSmoothingEnabled = false;
    fctx.clearRect(0, 0, 8, 8);
    fctx.drawImage(skin.img, 8, 8, 8, 8, 0, 0, 8, 8);   // face
    fctx.drawImage(skin.img, 40, 8, 8, 8, 0, 0, 8, 8);  // hat layer
  }
}

// little dance in the video screen
const dancer = document.getElementById("skin");
const dctx = dancer.getContext("2d");
const PX = 8; // canvas pixels per skin pixel
dancer.width = 24 * PX; dancer.height = 36 * PX;

function part(base, over, x, y, w, h, px, py, angle) {
  // base/over = [sx, sy] in the skin file; x,y,w,h = where on the 24x36 grid; px,py = pivot
  dctx.save();
  dctx.translate(px * PX, py * PX);
  dctx.rotate(angle);
  dctx.translate(-px * PX, -py * PX);
  dctx.drawImage(skin.img, base[0], base[1], w, h, x * PX, y * PX, w * PX, h * PX);
  if (over) dctx.drawImage(skin.img, over[0], over[1], w, h, x * PX, y * PX, w * PX, h * PX);
  dctx.restore();
}

let danceT = 0;
function drawDancer(dt) {
  if (!skin.img) return;
  if (playing && !reduceMotion) danceT += dt;
  const old = skin.img.height === 32; // very old skins have no separate left limbs
  const aw = skin.slim ? 3 : 4;
  const beat = (danceT / 460) * Math.PI;
  const bar = Math.floor(danceT / (460 * 8)) % 2; // every 8 beats switch moves
  const bounce = -Math.abs(Math.sin(beat)) * 1.2;
  const sway = Math.sin(beat / 2) * 0.07;

  dctx.imageSmoothingEnabled = false;
  dctx.clearRect(0, 0, dancer.width, dancer.height);
  dctx.save();
  dctx.translate(12 * PX, 34 * PX);
  dctx.rotate(sway);
  dctx.translate(-12 * PX, -34 * PX + bounce * PX);

  // legs
  const leg = Math.sin(beat) * 0.28;
  part([4, 20], [4, 36], 8, 22, 4, 12, 10, 22, leg);
  part(old ? [4, 20] : [20, 52], old ? null : [4, 52], 12, 22, 4, 12, 14, 22, -leg);
  // body
  part([20, 20], [20, 36], 8, 10, 8, 12, 12, 22, 0);
  // arms: wave side to side, then hands up in the air
  const armR = bar ? -2.7 + Math.sin(beat * 2) * 0.35 : Math.sin(beat) * 0.9 - 0.2;
  const armL = bar ? 2.7 - Math.sin(beat * 2) * 0.35 : -Math.sin(beat) * 0.9 + 0.2;
  part([44, 20], [44, 36], 8 - aw, 10, aw, 12, 8 - aw / 2, 11, armR);
  part(old ? [44, 20] : [36, 52], old ? null : [52, 52], 16, 10, aw, 12, 16 + aw / 2, 11, armL);
  // head
  part([8, 8], [40, 8], 8, 2, 8, 8, 12, 10, Math.sin(beat) * 0.15);
  dctx.restore();
}

loadSkin();

/* ---------------- title: emer3lds worlddddddd… ---------------- */
(function buildTitle() {
  const el = document.getElementById("vtitle");
  el.append(document.createTextNode("emer3lds worl"));
  const N = 24;
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1);
    const s = document.createElement("span");
    s.className = "d";
    s.textContent = "d";
    s.setAttribute("aria-hidden", "true");
    s.style.fontSize = `${1 + p * p * 2.2}em`;
    s.style.transform = `rotate(${p * p * 28}deg) translateY(${p * p * 0.25}em)`;
    s.style.marginLeft = `${-p * 0.06}em`;
    s.style.animationDelay = `${-i * 0.09}s`;
    s.style.setProperty("--drop", `${2 + p * 8}px`);
    if (p > 0.55) s.style.color = pick(["#222", "#0055aa", "#ff6600", "#39c5bb"]);
    el.append(s);
  }
})();

/* ---------------- 弾幕 ---------------- */
const canvas = document.getElementById("danmaku");
const ctx = canvas.getContext("2d");
const NICO_FONT = `"MS PGothic", "ＭＳ Ｐゴシック", "MS UI Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
const NICO_COLORS = {
  white: "#FFFFFF", red: "#FF0000", pink: "#FF8080", orange: "#FFC000", yellow: "#FFFF00",
  green: "#00FF00", cyan: "#00FFFF", blue: "#0000FF", purple: "#C000FF", black: "#000000",
};

// what you'd see scrolling over a popular vocaloid video
const POOL = [
  "うぽつ", "うぽつです", "わこつ", "神曲", "神曲きた", "神調教", "調教うますぎ", "ミクの声かわいい",
  "ミクさんマジ天使", "ここすき", "ここ好き", "←わかる", "←それな", "↑わかる",
  "初見", "初見です", "初見ですが中毒になりました", "毎日聴いてる", "リピート止まらん",
  "中毒性やばい", "鳥肌", "鳥肌立った", "サビ！！", "サビくるぞ", "前奏で神曲確定",
  "イントロ神", "ベースかっこよすぎ", "この音すき", "PV神", "絵師様神",
  "歌ってみた待機", "踊ってみた待機", "弾いてみた待機", "カラオケ入って", "殿堂入りおめでとう！",
  "伝説入りおめでとう！！", "ミリオンおめでとう！！", "伝説の始まり",
  "2008年から来ました", "10年後も聴いてる人→", "懐かしすぎる", "ニコ動黄金期",
  "定期的に聴きに来る", "久しぶりに来た", "おかえり", "ただいま", "今聴いても新しい",
  "語彙力消失", "エモい", "最高かよ", "天才かよ", "うp主天才", "P天才か",
  "なにこれすごい", "すげえええええ", "うおおおおおお", "かっけええええ", "かわいいいいい",
  "ミクううううう", "ネギ", "ネギ振れ", "39！", "サンキュー！",
  "泣いた", "なんか泣ける", "心にくる",
  "マイリス余裕でした", "保存した", "毎朝これで起きてる",
  "ここで画面止めてみ", "弾幕職人乙", "コメ多すぎて見えないｗ",
  "マイクラのスキンかわいい", "四角いｗｗｗ", "カクカク踊ってて草", "emer3ldさんだ！",
  "このサイト好き", "blogまだ？", "ここが噂の", "worlddddddd", "dが多いｗｗｗ",
  "who's here in 2026", "kawaii", "masterpiece", "love from brazil", "VOCALOID SUPREMACY",
  "wwwwwwww", "ｗｗｗｗｗ", "ｗｗｗ", "草", "大草原", "8888888888", "８８８８８",
  "キタ━━━(ﾟ∀ﾟ)━━━!!", "(´；ω；｀)", "(´・ω・`)", "( ˘ω˘ )", "( ﾟдﾟ)", "Σ(ﾟдﾟ；)",
  "(*´ω｀*)", "＼(^o^)／", "orz", "( ´∀｀)", "(｀・ω・´)", "ヽ(°▽、°)ﾉ", "_(:3」∠)_", "(っ´ω`c)",
];
const WALLS = [
  { text: "うおおおおおおおおおおおおお", color: "white" },
  { text: "8888888888888888888", color: "yellow" },
  { text: "ｗｗｗｗｗｗｗｗｗｗｗｗｗｗ", color: "white" },
  { text: "キタ━━━━(ﾟ∀ﾟ)━━━━!!", color: "white" },
];

let W = 0, H = 0, medium = 24, laneH = 28, repelR = 40;
let comments = [];
let lanes = [];
let playing = true;
let commentsOn = true;

function fit() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // niconico: medium text is 24px on a 384px-tall player
  medium = H * 24 / 384;
  laneH = medium * 1.12;
  const n = Math.max(4, Math.floor(H / laneH));
  lanes = Array.from({ length: n }, (_, i) => lanes[i] || null);
  lanes.length = n;
  repelR = H * 0.1;
  // re-measure existing comments at the new size
  for (const c of comments) measure(c);
}
new ResizeObserver(fit).observe(canvas);

const SIZE_SCALE = { small: 15 / 24, medium: 1, big: 39 / 24 };

function measure(c) {
  c.size = medium * SIZE_SCALE[c.sizeName];
  ctx.font = `600 ${c.size}px ${NICO_FONT}`;
  let ox = 0;
  for (const ch of c.chars) { ch.w = ctx.measureText(ch.ch).width; ch.ox = ox; ox += ch.w; }
  c.width = ox;
}

/* pointer in screen coordinates */
const pointer = { x: 0, y: 0, inside: false };
function track(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
  pointer.inside = pointer.x >= -repelR && pointer.y >= -repelR && pointer.x <= r.width + repelR && pointer.y <= r.height + repelR;
}
window.addEventListener("pointermove", track);
window.addEventListener("pointerdown", track);
window.addEventListener("pointerup", (e) => { if (e.pointerType === "touch") pointer.inside = false; });
document.addEventListener("pointerleave", () => { pointer.inside = false; });

function spawn(text, opts = {}) {
  const c = {
    text,
    sizeName: opts.size || "medium",
    chars: [...text].map((ch) => ({ ch, w: 0, ox: 0, dx: 0, dy: 0, a: 1 })),
    color: NICO_COLORS[opts.color] || "#FFFFFF",
    mine: !!opts.mine,
    type: opts.type || "naka", // naka = scrolling, ue = pinned top, shita = pinned bottom
    life: 3000,
    x: W, y: 0, speed: 0,
  };
  measure(c);
  // every comment is on screen for 4 seconds, so long ones move faster
  c.speed = (W + c.width) / 4000;

  if (c.type === "ue" || c.type === "shita") {
    const taken = new Set(comments.filter((o) => o.type === c.type).map((o) => o.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    c.slot = slot;
    c.x = (W - c.width) / 2;
    c.y = c.type === "ue" ? laneH * (slot + 0.5) : H - laneH * (slot + 0.5);
  } else {
    // first free lane from the top; if everything is full, overlap at random (like the real thing)
    let lane = -1;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i];
      if (!last) { lane = i; break; }
      const tail = last.x + last.width;
      if (tail < W - 6) {
        const catchUp = c.speed > last.speed && (W - tail) / (c.speed - last.speed) < tail / last.speed;
        if (!catchUp) { lane = i; break; }
      }
    }
    if (lane < 0) lane = Math.floor(Math.random() * lanes.length);
    lanes[lane] = c;
    c.y = laneH * (lane + 0.5);
  }
  comments.push(c);
  addRow(c);
  return c;
}

function update(dt) {
  const k = 1 - Math.exp(-dt * 0.018);
  const R = repelR;
  for (const c of comments) {
    if (playing) {
      if (c.type === "naka") c.x -= c.speed * dt;
      else c.life -= dt;
    }
    for (const ch of c.chars) {
      const bx = c.x + ch.ox + ch.w / 2, by = c.y;
      let tx = 0, ty = 0, ta = 1;
      if (pointer.inside) {
        const ddx = bx - pointer.x, ddy = by - pointer.y;
        const d = Math.hypot(ddx, ddy);
        if (d < R) {
          const nx = d > 0.5 ? ddx / d : 0, ny = d > 0.5 ? ddy / d : -1;
          tx = pointer.x + nx * R - bx;
          ty = pointer.y + ny * R - by;
          ta = 0.2 + 0.8 * (d / R);
        }
      }
      ch.dx += (tx - ch.dx) * k;
      ch.dy += (ty - ch.dy) * k;
      ch.a += (ta - ch.a) * k;
    }
  }
  comments = comments.filter((c) => (c.type === "naka" ? c.x + c.width > -4 : c.life > 0));
  const alive = new Set(comments);
  lanes = lanes.map((c) => (c && alive.has(c) ? c : null));
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (!commentsOn) return;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const c of comments) {
    ctx.font = `600 ${c.size}px ${NICO_FONT}`;
    if (c.mine) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#FFFF00";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 2, c.y - c.size * 0.58, c.width + 4, c.size * 1.16);
    }
    ctx.lineWidth = Math.max(2, c.size * 0.1);
    ctx.strokeStyle = c.color === "#000000" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    ctx.fillStyle = c.color;
    for (const ch of c.chars) {
      const x = c.x + ch.ox + ch.dx, y = c.y + ch.dy;
      ctx.globalAlpha = ch.a;
      ctx.strokeText(ch.ch, x, y);
      ctx.fillText(ch.ch, x, y);
    }
  }
  ctx.globalAlpha = 1;
}

function randomComment() {
  const opts = {};
  opts.color = Math.random() < 0.82 ? "white" : pick(["red", "pink", "orange", "yellow", "green", "cyan", "blue", "purple", "black"]);
  const r = Math.random();
  if (r < 0.08) opts.size = "big";
  else if (r < 0.18) opts.size = "small";
  const tr = Math.random();
  if (tr < 0.03) opts.type = "ue";
  else if (tr < 0.05) opts.type = "shita";
  return spawn(pick(POOL), opts);
}

function wall() {
  const w = pick(WALLS);
  const n = Math.ceil(lanes.length * 0.6);
  for (let i = 0; i < n; i++) setTimeout(() => spawn(w.text, { color: w.color }), i * rand(60, 140));
}

/* ---------------- side comment list ---------------- */
const list = document.getElementById("list");
const countEl = document.getElementById("count");
const viewsEl = document.getElementById("views");
let count = 93939;
let views = 1039393;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const fakeDate = () => `08/${String(Math.ceil(rand(0, 12))).padStart(2, "0")}/${String(Math.ceil(rand(0, 28))).padStart(2, "0")} ${String(Math.floor(rand(0, 24))).padStart(2, "0")}:${String(Math.floor(rand(0, 60))).padStart(2, "0")}`;

function addRow(c) {
  count++;
  countEl.textContent = count.toLocaleString();
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 30;
  const row = document.createElement("div");
  row.className = "row" + (c.mine ? " mine" : "");
  const t = document.createElement("span"); t.className = "t"; t.textContent = fmt(playhead);
  const m = document.createElement("span"); m.textContent = c.text; m.title = c.text;
  const w = document.createElement("span"); w.className = "w"; w.textContent = c.mine ? "たった今" : fakeDate();
  row.append(t, m, w);
  list.append(row);
  while (list.children.length > 200) list.firstChild.remove();
  if (atBottom || c.mine) list.scrollTop = list.scrollHeight;
}

/* ---------------- controls ---------------- */
const TOTAL = 219; // 3:39
let playhead = 0;
const playBtn = document.getElementById("play");
const toggleBtn = document.getElementById("toggle");
const seekFill = document.getElementById("seekFill");
const seekKnob = document.getElementById("seekKnob");
const curEl = document.getElementById("cur");
const stage = document.getElementById("stage");

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "❚❚" : "▶";
  stage.style.animationPlayState = playing ? "" : "paused";
});
toggleBtn.addEventListener("click", () => {
  commentsOn = !commentsOn;
  toggleBtn.setAttribute("aria-pressed", String(!commentsOn));
  toggleBtn.textContent = commentsOn ? "コメント非表示" : "コメント表示";
  document.querySelector(".ph-right b").textContent = commentsOn ? "ON" : "OFF";
});

document.getElementById("commentForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("commentInput");
  const text = input.value.trim();
  if (!text) return;
  if (!commentsOn) toggleBtn.click();
  spawn(text, { mine: true });
  input.value = "";
});

// click your skin or your face for a little cheer
function cheer() {
  const cheers = ["かわいい！！", "emer3ldさーん！", "きゃーーー", "♡♡♡♡♡", "(*´ω｀*)", "もっと踊って！"];
  for (let i = 0; i < 6; i++) setTimeout(() => spawn(pick(cheers), { color: pick(["pink", "yellow", "white", "cyan"]) }), i * 80);
}
document.getElementById("skin").addEventListener("click", cheer);
document.getElementById("face").addEventListener("click", cheer);

/* ---------------- loop ---------------- */
let last = performance.now();
let nextSpawn = 0;
let nextWall = performance.now() + rand(20000, 30000);
let nextView = 0;

function frame(t) {
  const dt = Math.min(50, t - last);
  last = t;
  if (playing && commentsOn) {
    if (t > nextSpawn) {
      randomComment();
      nextSpawn = t + (reduceMotion ? rand(1500, 2500) : rand(260, 720));
    }
    if (!reduceMotion && t > nextWall) {
      wall();
      nextWall = t + rand(35000, 55000);
    }
  }
  if (playing) {
    playhead = (playhead + dt / 1000) % TOTAL;
    const p = (playhead / TOTAL) * 100;
    seekFill.style.width = p + "%";
    seekKnob.style.left = p + "%";
    curEl.textContent = fmt(playhead);
  }
  if (t > nextView) {
    views += Math.ceil(Math.random() * 2);
    viewsEl.textContent = views.toLocaleString();
    nextView = t + rand(1500, 4000);
  }
  update(dt);
  draw();
  drawDancer(dt);
  requestAnimationFrame(frame);
}

fit();
// start with some comments already on screen
for (let i = 0; i < 12; i++) {
  const c = randomComment();
  if (c.type === "naka") c.x = rand(0, W);
}
requestAnimationFrame(frame);
