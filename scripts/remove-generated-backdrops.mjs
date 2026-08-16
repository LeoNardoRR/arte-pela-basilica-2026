import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const directory = path.join(process.cwd(), "public", "artworks-clean");

function isLightNeutral(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return Math.min(red, green, blue) > 212 && Math.max(red, green, blue) - Math.min(red, green, blue) < 22;
}

for (let number = 1; number <= 84; number += 1) {
  if (number === 63) continue;
  const filename = `${String(number).padStart(2, "0")}.webp`;
  const source = path.join(directory, filename);
  const temporary = path.join(directory, `${filename}.tmp.webp`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (index) => {
    if (visited[index]) return;
    const offset = index * channels;
    if (data[offset + 3] < 220 || isLightNeutral(data, offset)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index]) data[index * channels + 3] = 0;
  }

  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .webp({ quality: 88, alphaQuality: 96, effort: 5 })
    .toFile(temporary);
  await fs.rename(temporary, source);
}
