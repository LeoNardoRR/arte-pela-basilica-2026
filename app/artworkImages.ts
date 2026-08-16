export type CuratedArtworkImage = {
  slot: number;
  title: string;
  artist: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  license: string;
};

export const CURATED_ARTWORKS: CuratedArtworkImage[] = Array.from(
  { length: 84 },
  (_, index) => {
    const slot = index + 1;
    const filename = String(slot).padStart(2, "0");
    return {
      slot,
      title: `Quadro ${slot}`,
      artist: "Acervo Vernissage 2026",
      imageUrl: `/artworks/${filename}.jpg`,
      thumbnailUrl: `/artworks/${filename}.jpg`,
      sourceUrl: "",
      license: "Imagem fornecida pela organização do Vernissage 2026",
    };
  },
);
