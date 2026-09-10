import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Offline compiler for the typed, first-order integer subset used by this demo.
// Parse expressions rather than substituting text: Bend divisions truncate, all
// arithmetic wraps at 24 bits, and comparisons return u24, not JS booleans.
const identifier = /^[A-Za-z_]\w*$/;
const precedence = new Map([
  ['|', 0], ['^', 1], ['&', 2], ['==', 3], ['!=', 3],
  ['<', 4], ['>', 4], ['<=', 4], ['>=', 4],
  ['+', 6], ['-', 6], ['*', 7], ['/', 7], ['%', 7],
]);
const numeric = type => type === 'u24' || type === 'i24' || type === '_';
const jsName = name => name.replaceAll('/', '$');
const parameters = text => !text.trim() ? [] : text.split(',').map(item => {
  const match = item.trim().match(/^([A-Za-z_]\w*): ([A-Za-z_]\w*)$/);
  if (!match) throw Error(`Expected typed parameter: ${item}`);
  return { name: match[1], type: match[2] };
});

export function compile(source) {
  const objects = new Map();
  const definitions = new Map([
    ['u24/to_i24', { parameters: [{ name: 'x', type: 'u24' }], type: 'i24' }],
    ['i24/to_u24', { parameters: [{ name: 'x', type: 'i24' }], type: 'u24' }],
  ]);
  const lines = source.split('\n').map(raw => ({ raw, line: raw.split('#')[0].trimEnd() })).filter(({ line }) => line.trim());
  // Collect declarations first, so recursion and forward calls have known types.
  for (const { line } of lines) {
    let match;
    if ((match = line.match(/^object (\w+) \{ (.+) \}$/))) {
      const fields = parameters(match[2]);
      objects.set(match[1], new Map(fields.map(field => [field.name, field.type])));
      definitions.set(match[1], { parameters: fields, type: match[1], object: true });
    } else if ((match = line.match(/^type (\w+) = (.+)$/))) {
      const fields = new Map();
      for (const variant of match[2].split('|')) {
        const parts = variant.trim().match(/^\(([A-Za-z_]\w*) ((?:~?[A-Za-z_]\w* ?)+)\)$/);
        if (!parts) throw Error(`Unsupported datatype: ${line}`);
        const args = parts[2].trim().split(/\s+/).map(field => ({ name: field.replace('~', ''), type: field.startsWith('~') ? match[1] : 'Any' }));
        for (const field of args) fields.set(field.name, field.type);
        definitions.set(`${match[1]}/${parts[1]}`, { parameters: args, type: match[1], object: true });
      }
      objects.set(match[1], fields);
    } else if ((match = line.match(/^def (\w+)\((.*)\) -> (\w+):$/))) {
      if (definitions.has(match[1])) throw Error(`Duplicate definition: ${match[1]}`);
      definitions.set(match[1], { parameters: parameters(match[2]), type: match[3] });
    }
  }
  const output = [
    '// Generated from bend/game.bend. Edit the Bend source, then npm run build.',
    'const __u24 = n => n & 0xffffff;',
    'const __i24 = n => (n << 8) >> 8;',
    'const u24$to_i24 = __i24;',
    'const i24$to_u24 = __u24;',
    'const __div = (a, b) => { if (b === 0) throw new RangeError("Bend division by zero"); return Math.trunc(a / b); };',
    'const __rem = (a, b) => { if (b === 0) throw new RangeError("Bend remainder by zero"); return a % b; };',
  ];
  const compatible = (expected, actual) => expected === actual || expected === 'Any' || expected === 'T' || (expected === '_' && numeric(actual));
  let variables = new Map();
  const expression = text => {
    const tokens = text.match(/\d+|[A-Za-z_]\w*(?:\/[A-Za-z_]\w*)*(?:\.[A-Za-z_]\w*)?|==|!=|<=|>=|[+*%<>&|^(),\-/]/g) || [];
    if (tokens.join('') !== text.replaceAll(/\s/g, '')) throw Error(`Unsupported expression: ${text}`);
    let at = 0;
    const expect = token => { if (tokens[at++] !== token) throw Error(`Expected ${token}: ${text}`); };
    function atom() {
      let token = tokens[at++];
      if (token === '(') { const inner = parse(0); expect(')'); return inner; }
      let signed = false;
      if (token === '+' || token === '-') {
        signed = true;
        if (!/^\d+$/.test(tokens[at] ?? '')) throw Error(`Only signed integer literals are supported: ${text}`);
        token += tokens[at++];
      }
      if (/^[+-]?\d+$/.test(token ?? '')) {
        const n = Number(token);
        if (!Number.isSafeInteger(n) || n < -8388608 || n > (signed ? 8388607 : 16777215)) throw Error(`Out-of-range 24-bit literal: ${token}`);
        return { js: String(n), type: signed ? 'i24' : 'u24' };
      }
      if (!token) throw Error(`Incomplete expression: ${text}`);
      if (tokens[at] === '(') {
        const definition = definitions.get(token);
        if (!definition) throw Error(`Unknown function: ${token}`);
        at++;
        const args = [];
        if (tokens[at] !== ')') {
          do { args.push(parse(0)); } while (tokens[at] === ',' && ++at);
        }
        expect(')');
        if (args.length !== definition.parameters.length) throw Error(`Wrong argument count for ${token}`);
        const generic = new Map();
        args.forEach((arg, index) => {
          const expected = definition.parameters[index].type;
          if (!compatible(expected, arg.type)) throw Error(`Expected ${expected}, got ${arg.type} in ${token} argument ${index + 1}`);
          if (expected === 'T' || expected === '_') {
            if (generic.has(expected) && generic.get(expected) !== arg.type) throw Error(`Mixed numeric/types in ${token}: ${text}`);
            generic.set(expected, arg.type);
          }
        });
        return { js: `${jsName(token)}(${args.map(arg => arg.js).join(', ')})`, type: generic.get(definition.type) ?? definition.type };
      }
      const [name, field] = token.split('.');
      const type = variables.get(name);
      if (!type) throw Error(`Unknown variable: ${name}`);
      if (field) {
        const fieldType = objects.get(type)?.get(field);
        if (!fieldType) throw Error(`Unknown field: ${token}`);
        return { js: token, type: fieldType };
      }
      return { js: token, type };
    }
    function parse(minimum) {
      let left = atom();
      while (precedence.has(tokens[at]) && precedence.get(tokens[at]) >= minimum) {
        const operator = tokens[at++];
        const right = parse(precedence.get(operator) + 1);
        if (!numeric(left.type) || left.type !== right.type) throw Error(`Mixed or nonnumeric operands (${left.type}, ${right.type}): ${text}`);
        if (['==', '!=', '<', '<=', '>', '>='].includes(operator)) {
          left = { js: `Number(${left.js} ${operator} ${right.js})`, type: 'u24' };
        } else {
          if (left.type === '_') throw Error(`Generic arithmetic needs a concrete u24/i24 signature: ${text}`);
          const inner = operator === '/' ? `__div(${left.js}, ${right.js})`
            : operator === '%' ? `__rem(${left.js}, ${right.js})`
              : `(${left.js} ${operator} ${right.js})`;
          left = { js: `__${left.type}(${inner})`, type: left.type };
        }
      }
      return left;
    }
    const result = parse(0);
    if (at !== tokens.length) throw Error(`Unexpected token ${tokens[at]}: ${text}`);
    return result;
  };
  let depth = 0;
  let currentDefinition;
  let matchVariable = '';
  const close = n => { while (depth > n) output.push('  '.repeat(--depth) + '}'); };
  for (const { raw, line } of lines) {
    const indent = line.length - line.trimStart().length;
    if (indent % 2 || (indent && indent / 2 > depth)) throw Error(`Expected two-space block indentation: ${raw}`);
    const s = line.trim();
    const level = indent / 2;
    if (s.startsWith('object ') || s.startsWith('type ')) {
      if (level !== 0) throw Error(`Nested declaration: ${s}`);
      close(0);
      const match = s.match(/^(object|type) (\w+) /);
      if (!match || !objects.has(match[2])) throw Error(`Unsupported datatype: ${s}`);
      for (const [name, definition] of definitions) {
        if (!definition.object || definition.type !== match[2]) continue;
        const fields = definition.parameters.map(field => field.name).join(', ');
        output.push(`export const ${jsName(name)} = (${fields}) => Object.freeze({ tag: '${name}', ${fields} });`);
      }
    } else if (s.startsWith('def ')) {
      close(0);
      const match = s.match(/^def (\w+)\((.*)\) -> (\w+):$/);
      if (!match || level !== 0) throw Error(`Unsupported definition: ${s}`);
      currentDefinition = definitions.get(match[1]);
      variables = new Map(currentDefinition.parameters.map(parameter => [parameter.name, parameter.type]));
      output.push(`export function ${match[1]}(${currentDefinition.parameters.map(parameter => parameter.name).join(', ')}) {`);
      depth = 1;
    } else if (s.startsWith('open ')) {
      const match = s.match(/^open (\w+): (\w+)$/);
      if (!match || variables.get(match[2]) !== match[1] || !objects.has(match[1])) throw Error(`Unsupported open: ${s}`);
    } else if (s.startsWith('match ')) {
      close(level);
      matchVariable = s.slice(6, -1);
      if (!identifier.test(matchVariable) || !objects.has(variables.get(matchVariable)) || !s.endsWith(':')) throw Error(`Unsupported match: ${s}`);
      output.push('  '.repeat(level) + `switch (${matchVariable}.tag) {`); depth++;
    } else if (s.startsWith('case ')) {
      close(level);
      const variant = s.slice(5, -1);
      if (!s.endsWith(':') || !definitions.get(variant)?.object || definitions.get(variant).type !== variables.get(matchVariable)) throw Error(`Unsupported case: ${s}`);
      output.push('  '.repeat(level) + `case '${variant}': {`); depth++;
    } else {
      close(level);
      if (!level || !currentDefinition) throw Error(`Statement outside definition: ${s}`);
      const prefix = '  '.repeat(level);
      if (s.startsWith('if ') || s.startsWith('elif ')) {
        const isElse = s.startsWith('elif ');
        if (!s.endsWith(':')) throw Error(`Missing colon: ${s}`);
        const condition = expression(s.slice(isElse ? 5 : 3, -1));
        if (condition.type !== 'u24') throw Error(`Condition must be u24: ${s}`);
        output.push(prefix + `${isElse ? 'else if' : 'if'} (${condition.js}) {`); depth++;
      } else if (s === 'else:') {
        output.push(prefix + 'else {'); depth++;
      } else if (s.startsWith('return ')) {
        const result = expression(s.slice(7));
        if (!compatible(currentDefinition.type, result.type)) throw Error(`Return type ${result.type} does not match ${currentDefinition.type}: ${s}`);
        output.push(prefix + `return ${result.js};`);
      } else {
        const match = s.match(/^(\w+) = (.+)$/);
        if (!match || variables.has(match[1])) throw Error(`Unsupported assignment: ${s}`);
        const result = expression(match[2]);
        variables.set(match[1], result.type);
        output.push(prefix + `const ${match[1]} = ${result.js};`);
      }
    }
  }
  close(0);
  output.push(`export const sourceHash = '${createHash('sha256').update(source).digest('hex')}';`);
  return output.join('\n') + '\n';
}

export async function build() {
  const source = await readFile(new URL('../bend/game.bend', import.meta.url), 'utf8');
  const output = compile(source);
  await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
  await writeFile(new URL('../src/generated/game.js', import.meta.url), output);
  console.log(`Bend → browser: ${source.split('\n').length} source lines, typed 24-bit arithmetic, SHA-256 pinned.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
