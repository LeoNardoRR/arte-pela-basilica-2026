export type CuratedArtworkImage = {
  slot: number;
  title: string;
  artist: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  license: string;
};

export const ARTWORK_IMAGE_SOURCE_SLOTS: Record<number, number> = {
  4: 6, 5: 4, 6: 5, 7: 9, 8: 7, 9: 8, 10: 12, 11: 10, 12: 11,
  13: 15, 14: 13, 15: 14, 16: 18, 17: 16, 18: 17,
  22: 24, 23: 22, 24: 23, 25: 27, 26: 25, 27: 26,
  29: 30, 30: 29, 31: 33, 32: 31, 33: 32, 34: 36, 35: 34, 36: 35,
  37: 39, 38: 37, 39: 38, 40: 42, 41: 40, 42: 41,
  43: 45, 44: 43, 45: 44, 46: 48, 47: 46, 48: 47,
  49: 51, 50: 49, 51: 50, 52: 54, 53: 52, 54: 53, 55: 57, 56: 55, 57: 56,
  58: 60, 59: 58, 60: 59, 61: 63, 62: 61, 63: 62, 64: 66, 66: 64,
  71: 72, 72: 71, 74: 81, 75: 78, 76: 79, 77: 75, 78: 77, 79: 76,
  80: 74, 81: 80,
};

export const CURATED_ARTWORKS: CuratedArtworkImage[] = Array.from(
  { length: 84 },
  (_, index) => {
    const slot = index + 1;
    const sourceSlot = ARTWORK_IMAGE_SOURCE_SLOTS[slot] ?? slot;
    const filename = String(sourceSlot).padStart(2, "0");
    return {
      slot,
      title: `Quadro ${slot}`,
      artist: "Acervo Vernissage 2026",
      imageUrl: `/artworks-clean/${filename}.webp`,
      thumbnailUrl: `/artworks-clean/${filename}.webp`,
      sourceUrl: "",
      license: "Imagem fornecida pela organização do Vernissage 2026",
    };
  },
);
