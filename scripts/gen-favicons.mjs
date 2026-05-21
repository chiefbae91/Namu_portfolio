import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/logo.svg');
const outDir = join(__dirname, '../public');
const svg = readFileSync(svgPath);

const sizes = [16, 32, 48, 64, 128, 180];

for (const size of sizes) {
  const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
  await sharp(svg).resize(size, size).png().toFile(join(outDir, name));
  console.log(`✓ ${name}`);
}

// favicon.ico = 32x32
await sharp(svg).resize(32, 32).png().toFile(join(outDir, 'favicon.ico'));
console.log('✓ favicon.ico');
