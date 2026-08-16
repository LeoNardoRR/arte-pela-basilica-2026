import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const cleanDir = path.join(root, "public", "artworks-clean");

for (let number = 1; number <= 84; number += 1) {
  const filename = String(number).padStart(2, "0");
  const generatedPng = path.join(cleanDir, `${filename}.png`);
  const output = path.join(cleanDir, `${filename}.webp`);

  if (number === 63) {
    const source = path.join(root, "public", "artworks", "63.jpg");
    const mask = Buffer.from(`
      <svg width="422" height="512" viewBox="0 0 422 512" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,5 419,0 422,501 14,512" fill="white"/>
      </svg>
    `);
    await sharp(source)
      .extract({ left: 12, top: 146, width: 422, height: 512 })
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 96, effort: 5 })
      .toFile(output);
    continue;
  }

  await fs.access(generatedPng);
  await sharp(generatedPng)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 96, effort: 5 })
    .toFile(output);
}
