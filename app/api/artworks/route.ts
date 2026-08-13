import { env } from "cloudflare:workers";

const seedWorks = [
  [1, "OB-001", "Luz da manhã", "Artista a confirmar", "Óleo sobre tela", "80 × 60 cm", "available", "sunrise"],
  [2, "OB-002", "Caminho de fé", "Artista a confirmar", "Técnica mista", "70 × 50 cm", "available", "navy"],
  [3, "OB-003", "Santo silêncio", "Artista a confirmar", "Acrílica sobre tela", "90 × 70 cm", "reserved", "wine"],
  [4, "OB-004", "Jardim interior", "Artista a confirmar", "Óleo sobre tela", "60 × 60 cm", "available", "garden"],
  [5, "OB-005", "Entre arcos", "Artista a confirmar", "Técnica mista", "100 × 70 cm", "sold", "arches"],
  [6, "OB-006", "Vigília", "Artista a confirmar", "Acrílica sobre tela", "80 × 80 cm", "available", "night"],
] as const;

async function ensureCatalog() {
  const db = env.DB;
  await db.prepare(`CREATE TABLE IF NOT EXISTS artworks (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    technique TEXT NOT NULL,
    dimensions TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    palette TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY (artwork_id) REFERENCES artworks(id)
  )`).run();

  const count = await db.prepare("SELECT COUNT(*) AS total FROM artworks").first<{ total: number }>();
  if (!count?.total) {
    await db.batch(seedWorks.map((work) => db.prepare(
      "INSERT INTO artworks (id, code, title, artist, technique, dimensions, status, palette, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(...work, new Date().toISOString())));
  }
}

export async function GET() {
  try {
    await ensureCatalog();
    const result = await env.DB.prepare(
      "SELECT id, code, title, artist, technique, dimensions, status, palette FROM artworks ORDER BY id"
    ).all();
    return Response.json({ artworks: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar acervo." }, { status: 500 });
  }
}
