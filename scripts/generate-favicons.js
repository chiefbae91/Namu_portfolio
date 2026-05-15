const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svgPath = path.join(__dirname, '../public/logo.svg');
const outDir = path.join(__dirname, '../public');

const sizes = [
  { size: 16,  name: 'favicon-16x16.png' },
  { size: 32,  name: 'favicon-32x32.png' },
  { size: 48,  name: 'favicon-48x48.png' },
  { size: 64,  name: 'favicon-64x64.png' },
  { size: 128, name: 'favicon-128x128.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

async function main() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const { size, name } of sizes) {
    const outPath = path.join(outDir, name);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Use 32x32 PNG as favicon.ico (browsers accept PNG in .ico)
  fs.copyFileSync(path.join(outDir, 'favicon-32x32.png'), path.join(outDir, 'favicon.ico'));
  console.log('  ✓ favicon.ico');
}

main().catch(err => { console.error(err); process.exit(1); });
