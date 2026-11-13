const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../frontend/node_modules/sharp');
const dir = path.join(__dirname, '../frontend/public/icons');
async function main() {
  // Use paths for the letter, avoiding font-dependent app icon rendering.
  const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#2563eb"/><path d="M152 160h208v48h-80v144h-48V208h-80z" fill="white"/></svg>`);
  for (const size of [192, 512, 180]) await sharp(icon).resize(size,size).png().toFile(path.join(dir, size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`));
  const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#101827"/><rect x="80" y="88" width="120" height="120" rx="26" fill="#2563eb"/><path d="M110 116h60v16h-22v48h-16v-48h-22z" fill="white"/><text x="80" y="330" font-family="sans-serif" font-size="92" font-weight="700" fill="white">ToneBridge</text><text x="80" y="410" font-family="sans-serif" font-size="36" fill="#bfdbfe">Learn languages with friends.</text><text x="80" y="485" font-family="sans-serif" font-size="28" fill="#94a3b8">Listen. Practice. Share feedback. Try again.</text></svg>`);
  await sharp(og).png().toFile(path.join(dir,'og-image.png'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
