import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Unexpected output directory');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const entries = (await readdir(root)).filter(name =>
  /\.(html|css|js)$/.test(name) ||
  ['assets', 'fonts', 'stories-content.json', '.nojekyll'].includes(name)
);
for (const name of entries) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
let count = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else {
      if (!(await stat(file)).size && entry.name !== '.nojekyll') {
        throw new Error(`Empty output: ${file}`);
      }
      count++;
    }
  }
}
await inspect(output);
console.log(`Built ${count} files in dist/`);
