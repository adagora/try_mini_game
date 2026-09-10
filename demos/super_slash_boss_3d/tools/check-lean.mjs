import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../proofs', import.meta.url));
const source = await readFile(new URL('../proofs/SuperSlash.lean', import.meta.url), 'utf8');
if (/\b(sorry|admit|axiom)\s/.test(source.replace(/\/\-[\s\S]*?\-\//g, ''))) throw Error('Unproved declaration found.');
const local = fileURLToPath(new URL('../../../.tools/elan', import.meta.url));
let lake = process.env.LAKE || 'lake', env = { ...process.env };
try { await access(`${local}/bin/lake`); lake = `${local}/bin/lake`; env.ELAN_HOME = local; } catch { /* Use system Lake. */ }
const result = spawnSync(lake, ['build', '--wfail'], { cwd, env, encoding: 'utf8' });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
if (/sorryAx/.test(result.stdout + result.stderr)) throw Error('Unexpected proof escape hatch.');
console.log('Lean contracts compiled with warnings treated as errors.');
