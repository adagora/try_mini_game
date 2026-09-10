import { chromium } from 'playwright';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url));
await mkdir(artifacts, { recursive: true });
let executablePath = process.env.CHROME;
if (!executablePath) {
  const cached = '/Users/gora/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell';
  try { await access(cached); executablePath = cached; } catch { /* Playwright's default browser. */ }
}
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('request', request => requests.push(request.url()));
const snapshot = () => page.evaluate(() => window.__superSlash.snapshot());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4173');
  await page.waitForFunction(() => window.__superSlash?.snapshot().ready, { timeout: 20_000 });
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#error').isVisible(), false);
  let state = await snapshot();
  assert.equal(state.workersUsed, 4);
  assert.ok(state.stats.instances > 500);
  await page.screenshot({ path: `${artifacts}/01-title.png` });
  if (process.env.SMOKE_ONLY) {
    console.log(JSON.stringify({ state, errors }, null, 2));
    assert.deepEqual(errors, []);
  } else {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    state = await snapshot();
    assert.equal(state.playing, true);
    const originalX = state.world.player.x;
    await hold('d', 200);
    assert.ok((await snapshot()).world.player.x > originalX, 'D moves the player');
    await page.keyboard.press('i'); await page.waitForTimeout(100);
    state = await snapshot(); assert.ok(state.world.player.y > 0); assert.equal(state.world.player.jumps, 1);
    await page.keyboard.press('i'); await page.waitForTimeout(100);
    assert.equal((await snapshot()).world.player.jumps, 0);
    await page.keyboard.press('Escape');
    const frozen = (await snapshot()).world.frame;
    await page.waitForTimeout(250);
    assert.equal((await snapshot()).world.frame, frozen, 'Pause freezes simulation');
    await page.getByRole('button', { name: 'RESUME DUEL' }).click();
    await page.keyboard.press('r');
    await hold('l', 200);
    assert.ok((await snapshot()).world.player.shield < 100, 'L uses shield');
    await page.keyboard.press('k'); await page.waitForTimeout(30);
    assert.ok((await snapshot()).world.player.energy < 100, 'K spends special energy');
    await page.screenshot({ path: `${artifacts}/02-duel.png` });
    await page.keyboard.press('r');
    // Actual keyboard play: approach, stay near the boss, hold attacks, jump over windups.
    const held = new Set();
    const apply = async desired => {
      for (const key of held) if (!desired.has(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of desired) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
    };
    let jumped = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      state = await snapshot();
      if (state.world.status) break;
      const p = state.world.player, b = state.world.boss, desired = new Set(['j', 'k']);
      if (b.x - p.x > 110) desired.add('d'); else if (b.x - p.x < -110) desired.add('a');
      if (b.z - p.z > 60) desired.add('s'); else if (b.z - p.z < -60) desired.add('w');
      if (b.mode === 1 && b.timer > 95 && p.y === 0 && !jumped) {
        await page.keyboard.press('i'); jumped = true;
      }
      if (b.mode !== 1) jumped = false;
      await apply(desired);
      await page.waitForTimeout(90);
    }
    await apply(new Set());
    assert.equal(state.world.status, 1, `Keyboard-play boss defeat: ${JSON.stringify(state.world)}`);
    assert.equal(await page.getByRole('heading', { name: 'The blade falls.' }).isVisible(), true);
    await page.screenshot({ path: `${artifacts}/03-victory.png` });
    await page.keyboard.press('r');
    await page.keyboard.down('s');
    await page.waitForFunction(() => window.__superSlash.snapshot().world.status === 2, { timeout: 40_000 });
    await page.keyboard.up('s');
    assert.equal(await page.getByRole('heading', { name: 'Rise once more.' }).isVisible(), true);
    await page.screenshot({ path: `${artifacts}/04-defeat.png` });
    await page.getByRole('button', { name: 'START A NEW DUEL' }).click();
    state = await snapshot(); assert.equal(state.world.player.stocks, 3); assert.equal(state.world.status, 0);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal((await snapshot()).paused, true, 'Losing focus pauses the game');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'RESUME DUEL' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${artifacts}/05-mobile.png` });
    assert.ok(requests.every(url => url.startsWith('http://127.0.0.1:4173') || url.startsWith('data:')), 'No remote assets');
    assert.deepEqual(errors, [], 'No browser, shader, or network errors');
    const report = { passed: true, keyboardVictory: true, lossAndRetry: true, offline: true,
      workerCount: state.workersUsed, metrics: state.stats, fps: state.fps, cpuFrameMs: state.frameTime, errors };
    await writeFile(`${artifacts}/browser-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
} finally { await browser.close(); }
