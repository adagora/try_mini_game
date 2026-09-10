import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compile } from './build.mjs';
import { fixtures, nativeProbes, numbersInTree } from './conformance-fixtures.mjs';

async function executable(variable, local, fallback) {
  if (process.env[variable]) return process.env[variable];
  const path = fileURLToPath(new URL(local, import.meta.url));
  try { await access(path); return path; } catch { return fallback; }
}
const bend = await executable('BEND', '../../../.tools/bend/bin/bend', 'bend');
const hvm = await executable('HVM', '../../../.tools/bend/bin/hvm', 'hvm');
const run = args => {
  const result = spawnSync(bend, args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error(`Native Bend failed. Install bend-lang 0.2.38 and hvm 2.0.22, or set BEND/HVM.\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

const source = await readFile(new URL('../bend/game.bend', import.meta.url), 'utf8');
run(['check', fileURLToPath(new URL('../bend/game.bend', import.meta.url))]);
const probeSource = source + fixtures;
const browser = await import(`data:text/javascript;base64,${Buffer.from(compile(probeSource)).toString('base64')}`);
const directory = await mkdtemp(join(tmpdir(), 'super-slash-bend-'));
try {
  const path = join(directory, 'conformance.bend');
  for (const probe of nativeProbes) {
    const target = probe === 'main' ? 'reference_main' : probe;
    const nativeSource = probeSource.replace(/^def main\(\) -> u24:/m, 'def reference_main() -> u24:') + `\ndef main() -> _:\n  return ${target}()\n`;
    await writeFile(path, nativeSource);
    const output = run(['--hvm-bin', hvm, 'run-rs', path]);
    const result = output.match(/Result:\s*([\s\S]*)/);
    assert.ok(result, `${probe}: native result missing: ${output}`);
    const actual = [...result[1].matchAll(/(?<![\w])[-+]?\d+/g)].map(match => Number(match[0]));
    const expected = numbersInTree(browser[probe]());
    assert.deepEqual(actual, expected, `${probe}: native and browser simulation diverged`);
    console.log(`${probe}: ${expected.length} numeric fields agree with native Bend/HVM`);
  }
} finally {
  await rm(directory, { recursive: true });
}
