import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../.codex/agents/', import.meta.url);
const files = (await readdir(root)).filter((file) => file.endsWith('.toml')).sort();
const required = ['name', 'description', 'developer_instructions', 'model', 'model_reasoning_effort'];
const errors = [];

for (const file of files) {
  const source = await readFile(join(root.pathname, file), 'utf8');
  for (const key of required) {
    if (!new RegExp(`^${key}\\s*=`, 'm').test(source)) errors.push(`${file}: missing ${key}`);
  }
}

if (files.length !== 6) errors.push(`expected 6 Codex agents, found ${files.length}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${files.length} Codex agent configs.`);
