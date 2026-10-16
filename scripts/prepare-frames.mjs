import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { imageSize } from 'image-size';

const root = fileURLToPath(new URL('../public/frames/', import.meta.url));
const zipArg = process.argv.indexOf('--cafe-zip');
if (zipArg !== -1) {
  const archives = process.argv.slice(zipArg + 1);
  if (!archives.length) throw new Error('Usage: npm run frames -- --cafe-zip /path/to/coffee.zip [part2.zip ...]');
  const entries = archives.flatMap(archive => new AdmZip(resolve(archive)).getEntries())
    .filter(e => !e.isDirectory && !e.entryName.includes('__MACOSX') && !basename(e.entryName).startsWith('.') && /\.(jpe?g)$/i.test(e.entryName))
    .sort((a, b) => basename(a.entryName).localeCompare(basename(b.entryName), 'en', { numeric: true }));
  if (!entries.length) throw new Error('The ZIP contains no JPG frames.');
  if (new Set(entries.map(e => basename(e.entryName))).size !== entries.length) throw new Error('Duplicate frame filenames across the ZIPs. Supply distinct consecutive parts of one sequence.');
  const destination = resolve(root, 'cafe');
  mkdirSync(destination, { recursive: true });
  // Check all inputs and existing files before writing. Never overwrite different frames.
  const frames = entries.map((e, i) => {
    const buffer = e.getData();
    const dimensions = imageSize(buffer);
    if (dimensions.type !== 'jpg') throw new Error(`Not a valid JPEG: ${e.entryName}`);
    const path = resolve(destination, `c${String(i + 1).padStart(3, '0')}.jpg`);
    if (existsSync(path) && !readFileSync(path).equals(buffer)) throw new Error(`Existing frame differs: ${path}. Preserve or move the old sequence first.`);
    return { path, buffer };
  });
  const expected = new Set(frames.map(f => basename(f.path)));
  if (readdirSync(destination).some(f => /\.(jpe?g|png|webp)$/i.test(f) && !expected.has(f))) {
    throw new Error('Extra images exist in public/frames/cafe. Preserve or move the old sequence first.');
  }
  for (const frame of frames) writeFileSync(frame.path, frame.buffer);
  console.log(`Imported ${frames.length} coffee frames, in numeric order.`);
}

const manifest = {};
for (const scene of ['cars', 'cafe']) {
  const directory = resolve(root, scene);
  mkdirSync(directory, { recursive: true });
  const names = readdirSync(directory).filter(name => /\.(jpe?g|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const frames = names.map(name => {
    const { width, height } = imageSize(readFileSync(resolve(directory, name)));
    if (!width || !height) throw new Error(`Unreadable frame: ${scene}/${name}`);
    return { src: `/frames/${scene}/${name}`, width, height };
  });
  manifest[scene] = { frames, count: frames.length };
  console.log(`${scene}: ${frames.length} frames${frames.length ? `; first frame ${frames[0].width}×${frames[0].height}` : ' (source pending)'}`);
}
writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
