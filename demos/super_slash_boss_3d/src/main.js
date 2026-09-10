import { initial, step, Input, sourceHash } from './generated/game.js';
import { Renderer } from './engine/renderer.js';
import { camera, v, mix } from './engine/math.js';
import { branch, empty } from './engine/tree.js';
import { ribbon } from './engine/mesh.js';
import { staticRegion, indexScene, props, dynamicScene, evolveCuts } from './scene.js';
import { Sound } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), sound = new Sound();
let renderer, scene = empty, propTree = props(), world = initial(), cuts;
let playing = false, paused = false, jumpQueued = false, keys = {}, ready = false;
let accumulator = 0, lastTime = 0, visualTime = 0, shake = 0, fps = 60, frameTime = 0;
let reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let followX = 0, followZ = 0, workersUsed = 0;
$('motion').checked = reduceMotion;
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
const clearInput = () => { keys = {}; jumpQueued = false; accumulator = 0; };

function failure(error) {
  $('error-copy').textContent = error.message; show('error', true); console.error(error);
}
function updateHUD() {
  const p = world.player, b = world.boss;
  $('boss-health').style.width = `${b.hp / 720 * 100}%`;
  $('boss-hp').textContent = `${b.hp} / 720`;
  $('phase').innerHTML = b.phase === 2 ? 'II <span class="muted">/ UNBOUND</span>' : 'I <span class="muted">/ AWAKENING</span>';
  $('damage').textContent = p.damage;
  $('damage').style.color = p.damage >= 100 ? '#ef9c78' : '';
  $('stocks').textContent = '◆ '.repeat(p.stocks).trim() || '—';
  $('stocks').setAttribute('aria-label', `${p.stocks} lives remaining`);
  $('shield-meter').style.width = `${p.shield}%`; $('shield-number').textContent = p.shield;
  $('energy-meter').style.width = `${p.energy}%`; $('energy-number').textContent = p.energy;
  $('combo').textContent = String(world.combo).padStart(2, '0');
  const seconds = Math.floor(world.frame / 60);
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('callout').textContent = b.mode === 1 ? 'BLADE DRAWN — JUMP OR SHIELD' : b.mode === 3 ? 'OPENING — STRIKE NOW' : b.phase === 2 ? 'PHASE II · THE RONIN IS UNBOUND' : '';
}
function start() {
  if (!ready) return;
  world = initial(); cuts = undefined; playing = true; paused = false; visualTime = 0;
  shake = 0; followX = followZ = 0; clearInput();
  document.body.classList.add('playing');
  show('player-hud', true); show('combat-info', true); show('overlay', false);
  updateHUD(); sound.activate(); canvas.focus({ preventScroll: true });
}
function pause(value = !paused) {
  if (!playing || world.status) return;
  paused = value; clearInput(); show('overlay', paused);
  $('overlay-eyebrow').textContent = 'TAKE A BREATH'; $('overlay-title').textContent = 'Duel paused.';
  $('overlay-copy').textContent = 'The shrine can wait. Resume when you are ready.';
  show('resume', true); $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  if (paused) $('resume').focus(); else canvas.focus({ preventScroll: true });
}
function finish() {
  const won = world.status === 1;
  clearInput(); show('overlay', true); show('resume', false);
  $('overlay-eyebrow').textContent = won ? 'CALAMITY SILENCED' : 'THE SHRINE REMEMBERS';
  $('overlay-title').textContent = won ? 'The blade falls.' : 'Rise once more.';
  $('overlay-copy').textContent = won ? `The Hollow Ronin is defeated. ${world.player.stocks} lives remaining · best chain ${world.best} · ${$('timer').textContent}.` : 'The void claimed your last life. Watch the windup, jump above the slash, and punish the recovery.';
  $('restart').focus();
}
function tick() {
  const previous = world;
  const input = Input((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0),
    jumpQueued ? 1 : 0, keys.KeyJ ? 1 : 0, keys.KeyK ? 1 : 0, keys.KeyL ? 1 : 0);
  jumpQueued = false; world = step(world, input);
  cuts = evolveCuts(previous, world, cuts, propTree);
  if (world.player.vy > previous.player.vy && input.jump) sound.tone('jump');
  if (world.player.attack > previous.player.attack) sound.tone(input.special ? 'special' : 'attack');
  if (world.boss.hp < previous.boss.hp) { sound.tone('hit'); shake = .13; }
  if (world.player.damage > previous.player.damage) { sound.tone('hit'); shake = .24; }
  if (world.player.shield < previous.player.shield - 1) { sound.tone('block'); shake = .055; }
  if (world.boss.mode === 1 && previous.boss.mode !== 1) sound.tone('warning');
  if (world.frame % 4 === 0 || world.status) updateHUD();
  if (world.status && !previous.status) finish();
}

function frame(timeMs) {
  const time = timeMs / 1000, elapsed = Math.min(.1, lastTime ? time - lastTime : 0); lastTime = time;
  const begin = performance.now();
  if (!paused && !world.status) visualTime += elapsed;
  if (playing && !paused && !world.status) {
    accumulator += elapsed;
    while (accumulator >= 1 / 60) { tick(); accumulator -= 1 / 60; if (world.status) break; }
  }
  const visualWorld = playing ? world : { ...world, player: { ...world.player, x: -180, z: 180 },
    boss: { ...world.boss, x: 290, z: -15, aimx: -200, aimz: 150, mode: 0 } };
  const t = reduceMotion ? (playing && !paused ? visualTime * .4 : 0) : visualTime;
  followX = mix(followX, playing ? Math.max(-2, Math.min(2, world.player.x / 350)) : 1.2, .025);
  followZ = mix(followZ, playing ? Math.max(-1, Math.min(1, world.player.z / 550)) : 0, .025);
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const zoom = aspect < 1 ? 1.52 : 1;
  const cameraShake = reduceMotion || paused ? 0 : shake;
  shake *= .87;
  const cam = camera(v((11.8 + followX) * zoom + Math.sin(time * 83) * cameraShake,
    10.6 * zoom + Math.cos(time * 91) * cameraShake, (18.8 + followZ) * zoom),
    v(followX - (playing ? 0 : 1.4), .1, followZ), aspect, .78);
  renderer.addMesh('bossRibbon', ribbon(t, 3.6, .5, 0, Math.PI * 1.5, .22), true);
  renderer.addMesh('playerRibbon', ribbon(t, visualWorld.player.attack_kind === 2 ? 2.8 : 1.8, .3, 0, Math.PI * 1.4, .15), true);
  renderer.render(scene, dynamicScene(visualWorld, t, propTree, cuts), cam, t);
  $('hit-flash').style.opacity = playing && world.player.hurt > 34 ? '.8' : '0';
  fps = fps * .95 + (elapsed > 0 ? 1 / elapsed : 60) * .05;
  frameTime = frameTime * .95 + (performance.now() - begin) * .05;
  requestAnimationFrame(frame);
}

async function generateScene() {
  const region = id => new Promise(resolve => {
    if (!globalThis.Worker) { resolve(indexScene(staticRegion(id))); return; }
    const worker = new Worker(new URL('./scene-worker.js', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => { worker.terminate(); resolve(indexScene(staticRegion(id))); }, 8000);
    worker.onmessage = event => { clearTimeout(timeout); worker.terminate(); workersUsed++; resolve(event.data.tree); };
    worker.onerror = event => { event.preventDefault(); clearTimeout(timeout); worker.terminate(); resolve(indexScene(staticRegion(id))); };
    worker.postMessage({ region: id });
  });
  // Four independent pure scene subtrees; join only after all workers complete.
  const a = region(0), b = region(1), c = region(2), d = region(3);
  scene = indexScene(branch(branch(await a, await b), branch(await c, await d)));
}

$('start').addEventListener('click', start); $('restart').addEventListener('click', start);
$('resume').addEventListener('click', () => pause(false)); $('pause').addEventListener('click', () => pause());
const toggleSound = () => { $('sound-label').textContent = sound.toggle() ? 'ON' : 'OFF'; };
$('sound').addEventListener('click', toggleSound);
const fullscreen = () => {
  const action = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
  action?.catch(() => {});
};
$('fullscreen').addEventListener('click', fullscreen);
$('motion').addEventListener('change', event => { reduceMotion = event.target.checked; });
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement) return;
  if (/^(Key[WASDJKILRMF]|Enter|Escape|Space)$/.test(event.code)) event.preventDefault();
  if (event.repeat && /^(Enter|Escape|Key[RMF])$/.test(event.code)) return;
  if (event.code === 'Enter' && !playing) { start(); return; }
  if (event.code === 'Escape') { pause(); return; }
  if (event.code === 'KeyR' && playing) { start(); return; }
  if (event.code === 'KeyM') { toggleSound(); return; }
  if (event.code === 'KeyF') { fullscreen(); return; }
  if (playing && !paused && !world.status) {
    if (event.code === 'KeyI' && !keys.KeyI) jumpQueued = true;
    keys = { ...keys, [event.code]: true };
  }
});
document.addEventListener('keyup', event => { keys = { ...keys, [event.code]: false }; });
window.addEventListener('blur', () => { clearInput(); if (playing && !paused) pause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(true); });
document.querySelectorAll('[data-key]').forEach(button => {
  const release = () => { keys = { ...keys, [button.dataset.key]: false }; };
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); if (!playing || paused || world.status) return;
    button.setPointerCapture(event.pointerId);
    if (button.dataset.key === 'KeyI' && !keys.KeyI) jumpQueued = true;
    keys = { ...keys, [button.dataset.key]: true };
  });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});
// Read-only diagnostics for reproducible browser verification, never a gameplay override.
Object.defineProperty(window, '__superSlash', { value: Object.freeze({
  snapshot: () => structuredClone({ world, paused, playing, ready, cuts, workersUsed, sourceHash,
    stats: renderer?.stats, fps: Math.round(fps), frameTime: Math.round(frameTime * 100) / 100 })
}) });

try {
  $('start').disabled = true;
  renderer = new Renderer(canvas);
  await generateScene();
  ready = true; $('start').disabled = false;
  requestAnimationFrame(frame);
} catch (error) { failure(error); }
