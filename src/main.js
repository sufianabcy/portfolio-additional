import './styles.css';

const GITHUB_USER = 'sufianabcy';
const EMAIL = 'contact.sufianchoudhury@gmail.com';
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const systemDark = matchMedia('(prefers-color-scheme: dark)');

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

document.querySelector('[data-year]').textContent = new Date().getFullYear();
if (!/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelectorAll('.kbd-mod').forEach((k) => (k.textContent = 'Ctrl K'));

/* Theme */

const isDark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && systemDark.matches);
function syncTheme() {
  root.classList.toggle('is-dark', isDark());
  dispatchEvent(new Event('themechange'));
}
function toggleTheme() {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  store.set('theme', root.dataset.theme);
  syncTheme();
}
systemDark.addEventListener('change', syncTheme);
document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
syncTheme();

/* Toast */

const toastEl = document.querySelector('.toast');
let toastTimer;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
}

/* Seed: a small network that changes every day. One node is the anomaly. */

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveColor(token) {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function setupSeed() {
  const button = document.querySelector('.seed');
  const canvas = button.querySelector('canvas');
  const label = button.querySelector('.seed__label');
  const ctx = canvas.getContext('2d');
  const now = new Date();
  const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  let nodes = [];
  let colors = {};
  let visible = true;
  let frame = 0;

  function reseed(seed) {
    const rand = mulberry32(seed);
    nodes = Array.from({ length: 18 + Math.floor(rand() * 6) }, () => ({
      x: 0.1 + rand() * 0.8, y: 0.1 + rand() * 0.8,
      vx: (rand() - 0.5) * 0.0012, vy: (rand() - 0.5) * 0.0012,
      r: 0.8 + rand() * 1.4,
    }));
    nodes[0].anomaly = true;
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    for (const n of nodes) {
      if (!reduced) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0.06 || n.x > 0.94) n.vx *= -1;
        if (n.y < 0.06 || n.y > 0.94) n.vy *= -1;
      }
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0.3) continue;
        ctx.globalAlpha = (1 - d / 0.3) * 0.55;
        ctx.strokeStyle = a.anomaly || b.anomaly ? colors.accent : colors.line;
        ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const n of nodes) {
      ctx.fillStyle = n.anomaly ? colors.accent : colors.node;
      ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.anomaly ? 2.2 : n.r, 0, Math.PI * 2); ctx.fill();
    }
    const a = nodes[0];
    const pulse = reduced ? 0.5 : (t / 1600) % 1;
    ctx.globalAlpha = 1 - pulse;
    ctx.strokeStyle = colors.accent;
    ctx.beginPath(); ctx.arc(a.x * w, a.y * h, 2.5 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    frame = visible && !document.hidden && !reduced ? requestAnimationFrame(loop) : 0;
  }
  function start() { if (!frame) frame = requestAnimationFrame(loop); }

  function recolor() {
    colors = { node: resolveColor('--muted'), line: resolveColor('--faint'), accent: resolveColor('--accent') };
    if (reduced) draw(0);
  }

  reseed(now.getFullYear() * 1000 + day);
  label.textContent = `SEED::DAY-${String(day).padStart(3, '0')}`;
  resize();
  recolor();
  addEventListener('themechange', recolor);
  addEventListener('resize', () => { resize(); if (reduced) draw(0); });
  document.addEventListener('visibilitychange', start);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
  button.addEventListener('click', () => {
    const seed = Math.floor(Math.random() * 0xffff);
    reseed(seed);
    label.textContent = `SEED::#${seed.toString(16).toUpperCase().padStart(4, '0')}`;
    if (reduced) draw(0);
  });
  start();
}

/* GitHub: "pushed 3d ago" and a 12-week commit sparkline per project. Hidden if GitHub can't be reached. */

const CACHE_KEY = 'gh-activity-v2';
const CACHE_MS = 60 * 60 * 1000;

// GitHub answers 202 while it computes repo stats for the first time, so stats requests are retried a few times.
async function ghJson(path, retries = 3) {
  const res = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 202 && retries > 0) {
    await new Promise((r) => setTimeout(r, (4 - retries) * 1500));
    return ghJson(path, retries - 1);
  }
  if (!res.ok || res.status === 202) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

async function loadActivity(repos) {
  try {
    const cached = JSON.parse(store.get(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  } catch {}
  const list = await ghJson(`/users/${GITHUB_USER}/repos?per_page=100`);
  const pushed = Object.fromEntries(list.map((r) => [r.name, r.pushed_at]));
  const weeks = await Promise.all(
    repos.map((name) => ghJson(`/repos/${GITHUB_USER}/${name}/stats/participation`).then((p) => p.all.slice(-12), () => null)),
  );
  const data = Object.fromEntries(repos.map((name, i) => [name, { pushed: pushed[name], weeks: weeks[i] }]));
  // Keep a partial result for only a couple of minutes so the missing sparklines are tried again soon.
  const complete = weeks.every(Boolean);
  store.set(CACHE_KEY, JSON.stringify({ at: complete ? Date.now() : Date.now() - CACHE_MS + 2 * 60 * 1000, data }));
  return data;
}

function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return 'just now';
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo ago`;
  return `${Math.floor(s / (86400 * 365))}y ago`;
}

async function setupActivity() {
  const projects = [...document.querySelectorAll('.project[data-repo]')];
  let data;
  try {
    data = await loadActivity(projects.map((p) => p.dataset.repo));
  } catch (err) {
    console.info('GitHub activity unavailable:', err.message);
    return;
  }
  for (const p of projects) {
    const info = data[p.dataset.repo];
    if (!info?.pushed) continue;
    const box = p.querySelector('.activity');
    let html = '';
    if (info.weeks?.length) {
      const max = Math.max(1, ...info.weeks);
      const bars = info.weeks
        .map((n) => (n ? `<i style="height:${Math.max(3, Math.round((n / max) * 11))}px"></i>` : '<i class="zero"></i>'))
        .join('');
      const total = info.weeks.reduce((a, b) => a + b, 0);
      html += `streak <span class="spark" title="${total} commits in the last 12 weeks">${bars}</span>`;
    }
    box.innerHTML = `${html}<span>pushed ${ago(info.pushed)}</span>`;
  }
}

/* Command palette (⌘K / Ctrl K, or /) */

function setupPalette() {
  const el = document.querySelector('.palette');
  const input = el.querySelector('input');
  const listEl = el.querySelector('.palette__list');
  const trigger = document.querySelector('.search-trigger');
  let results = [];
  let active = 0;
  let lastFocus = null;

  const open = (url) => window.open(url, url.startsWith('mailto:') ? '_self' : '_blank', 'noopener');
  const jump = (id) => document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });

  const items = [
    ...[...document.querySelectorAll('.project')].map((p) => {
      const href = p.querySelector('.links a').href;
      const badge = p.querySelector('.badge');
      return {
        group: 'Projects', icon: '◇', title: p.querySelector('.project__name').textContent,
        sub: p.querySelector('.tagline').textContent.replace(/^—\s*/, ''),
        badge: badge?.textContent, tone: badge?.dataset.tone,
        keys: [...p.querySelectorAll('.chips li')].map((c) => c.textContent).join(' '),
        run: () => open(href),
      };
    }),
    ...[...document.querySelectorAll('main section[id]')].map((s) => ({
      group: 'Sections', icon: '#', title: s.querySelector('h2').textContent, sub: 'Jump to section', run: () => jump(s.id),
    })),
    ...[...document.querySelectorAll('.note')].map((n) => ({
      group: 'Write-ups', icon: '¶', title: n.querySelector('.note__title').textContent,
      sub: n.querySelector('.note__desc').textContent, run: () => open(n.href),
    })),
    { group: 'Actions', icon: '◐', title: 'Toggle theme', sub: 'Switch between light and dark', run: toggleTheme },
    {
      group: 'Actions', icon: '@', title: 'Copy email address', sub: EMAIL,
      run: () => navigator.clipboard.writeText(EMAIL).then(() => toast('Email copied'), () => open(`mailto:${EMAIL}`)),
    },
    { group: 'Links', icon: '↗', title: 'GitHub', sub: `github.com/${GITHUB_USER}`, run: () => open(`https://github.com/${GITHUB_USER}`) },
    { group: 'Links', icon: '↗', title: 'LinkedIn', sub: 'linkedin.com/in/sufian0', run: () => open('https://www.linkedin.com/in/sufian0/') },
    { group: 'Links', icon: '✉', title: 'Send an email', sub: EMAIL, run: () => open(`mailto:${EMAIL}`) },
  ];

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function filter(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items
      .map((item) => {
        const title = item.title.toLowerCase();
        const hay = `${title} ${item.sub} ${item.keys || ''} ${item.group}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const score = title.startsWith(words[0]) ? 0 : title.includes(words[0]) ? 1 : 2;
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.item);
  }

  function render() {
    results = filter(input.value);
    active = Math.min(active, Math.max(0, results.length - 1));
    if (!results.length) {
      listEl.innerHTML = '<p class="palette__empty">No results</p>';
      input.removeAttribute('aria-activedescendant');
      return;
    }
    // Keep groups together in the order they first appear in the results.
    const groups = [...new Set(results.map((r) => r.group))];
    results = groups.flatMap((g) => results.filter((r) => r.group === g));
    let html = '';
    results.forEach((r, i) => {
      if (i === 0 || results[i - 1].group !== r.group) html += `<p class="palette__group">${r.group}</p>`;
      const badge = r.badge ? `<span class="badge"${r.tone ? ` data-tone="${r.tone}"` : ''}>${esc(r.badge)}</span>` : '';
      html += `<div class="palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === active}">
        <span class="palette__icon" aria-hidden="true">${r.icon}</span>
        <span class="palette__text"><span class="palette__title">${esc(r.title)}${badge}</span><span class="palette__sub">${esc(r.sub)}</span></span>
        <span class="palette__go" aria-hidden="true">${i === active ? '↵' : ''}</span></div>`;
    });
    listEl.innerHTML = html;
    input.setAttribute('aria-activedescendant', `pal-${active}`);
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    listEl.querySelectorAll('.palette__item').forEach((node) => {
      const on = Number(node.dataset.i) === active;
      node.setAttribute('aria-selected', String(on));
      node.querySelector('.palette__go').textContent = on ? '↵' : '';
      if (on) node.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', `pal-${active}`);
  }

  function show() {
    if (!el.hidden) return;
    lastFocus = document.activeElement;
    el.hidden = false;
    root.style.overflow = 'hidden';
    input.value = '';
    active = 0;
    render();
    input.focus();
  }
  function hide() {
    if (el.hidden) return;
    el.hidden = true;
    root.style.overflow = '';
    lastFocus?.focus?.();
  }
  function choose(i) {
    const r = results[i];
    if (!r) return;
    hide();
    r.run();
  }

  trigger.addEventListener('click', show);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return hide();
    const item = e.target.closest('.palette__item');
    if (item) choose(Number(item.dataset.i));
  });
  listEl.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.palette__item');
    if (item && Number(item.dataset.i) !== active) setActive(Number(item.dataset.i));
  });
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el.hidden ? show() : hide(); }
    else if (e.key === 'Escape') hide();
    else if (e.key === '/' && el.hidden && !e.target.closest('input, textarea, [contenteditable]')) { e.preventDefault(); show(); }
  });
}

setupSeed();
setupPalette();
setupActivity();
