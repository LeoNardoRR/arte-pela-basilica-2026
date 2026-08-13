import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "public/artworks");
const headers = { "User-Agent": "Arte-pela-Basilica/1.0 (catalogo beneficente)" };
await mkdir(outputDirectory, { recursive: true });

async function getJson(url, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.ok) return response.json();
    if (attempt === attempts) throw new Error(`Falha ${response.status}: ${url}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 350));
  }
}

const search = await getJson("https://collectionapi.metmuseum.org/public/collection/v1/search?isHighlight=true&hasImages=true&q=painting");
const candidates = [];
for (let index = 0; index < Math.min(search.objectIDs.length, 240) && candidates.length < 60; index += 6) {
  const batch = search.objectIDs.slice(index, index + 6);
  const objects = await Promise.all(batch.map((id) => getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)));
  for (const object of objects) {
    const looksLikePainting = /paint|oil|tempera|watercolor|gouache|pastel|ink/i.test(`${object.objectName} ${object.medium}`);
    if (!object.isPublicDomain || !object.primaryImageSmall || !looksLikePainting) continue;
    candidates.push(object);
    if (candidates.length === 60) break;
  }
  process.stdout.write(`\rSelecionadas ${candidates.length}/60`);
}

if (candidates.length !== 60) throw new Error(`Só foi possível selecionar ${candidates.length} obras.`);

for (const [index, artwork] of candidates.entries()) {
  const response = await fetch(artwork.primaryImageSmall, { headers });
  if (!response.ok) throw new Error(`Falha ${response.status} ao baixar ${artwork.primaryImageSmall}`);
  await writeFile(resolve(outputDirectory, `${String(index + 1).padStart(2, "0")}.jpg`), Buffer.from(await response.arrayBuffer()));
  process.stdout.write(`\rIncorporadas ${index + 1}/60`);
}

const records = candidates.map((artwork, index) => ({
  slot: index + 1,
  museumId: artwork.objectID,
  title: artwork.title || "Obra sem título",
  artist: artwork.artistDisplayName || artwork.culture || "Artista desconhecido",
  date: artwork.objectDate || "Data desconhecida",
  imageUrl: `/artworks/${String(index + 1).padStart(2, "0")}.jpg`,
  thumbnailUrl: `/artworks/${String(index + 1).padStart(2, "0")}.jpg`,
  sourceUrl: artwork.objectURL,
  license: "Public Domain — The Metropolitan Museum of Art",
}));

const generated = `// Generated from The Metropolitan Museum of Art Open Access API.\n// Every image below was returned with isPublicDomain=true.\nexport type CuratedArtworkImage = {\n  slot: number; museumId: number; title: string; artist: string; date: string;\n  imageUrl: string; thumbnailUrl: string; sourceUrl: string; license: string;\n};\n\nexport const CURATED_ARTWORKS: CuratedArtworkImage[] = ${JSON.stringify(records, null, 2)};\n`;
await writeFile(resolve(root, "app/artworkImages.ts"), generated);
process.stdout.write("\n60 obras públicas incorporadas e catalogadas.\n");
