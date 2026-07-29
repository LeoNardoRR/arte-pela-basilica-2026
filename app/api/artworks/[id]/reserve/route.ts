import { env } from "cloudflare:workers";

type ReservationPayload = { name?: unknown; email?: unknown; phone?: unknown };

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const artworkId = Number(rawId);
  if (!Number.isInteger(artworkId) || artworkId < 1) {
    return Response.json({ error: "Obra inválida." }, { status: 400 });
  }

  try {
    const payload = await request.json() as ReservationPayload;
    const name = text(payload.name, 120);
    const email = text(payload.email, 160);
    const phone = text(payload.phone, 40);
    if (!name || !email.includes("@") || !phone) {
      return Response.json({ error: "Preencha nome, e-mail e WhatsApp." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update = env.DB.prepare(
      "UPDATE artworks SET status = 'reserved', updated_at = ? WHERE id = ? AND status = 'available'"
    ).bind(now, artworkId);
    const reservation = env.DB.prepare(
      "INSERT INTO reservations (artwork_id, name, email, phone, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
    ).bind(artworkId, name, email, phone, now);

    const updateResult = await update.run();
    if (!updateResult.meta.changes) {
      return Response.json({ error: "Esta obra acabou de ser reservada ou adquirida." }, { status: 409 });
    }

    try {
      await reservation.run();
    } catch (error) {
      await env.DB.prepare("UPDATE artworks SET status = 'available', updated_at = ? WHERE id = ? AND status = 'reserved'").bind(now, artworkId).run();
      throw error;
    }

    const artwork = await env.DB.prepare(
      "SELECT id, code, title, artist, technique, dimensions, status, palette FROM artworks WHERE id = ?"
    ).bind(artworkId).first();
    return Response.json({ artwork }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao reservar a obra." }, { status: 500 });
  }
}
