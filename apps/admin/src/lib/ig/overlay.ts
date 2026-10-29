/* Where the text sits on each category template, measured from the published Canva templates
   (scratchpad tpl/measure2.cjs over the brand-template thumbnails, 2026-10-29). Drives the editable
   preview in the studio: the copy is laid over a text-free render of the template in these boxes.
   x / w are fractions of the image width, y / h fractions of the image height; y is the top of the
   glyphs (ascender line) for text, the top edge for the pill. Re-measure when a template moves. */

export type Format = 'sq' | 'st';
export interface TextBox { x: number; y: number; w: number }
export interface PillBox extends TextBox { h: number }
export interface LayoutBoxes { eyebrow: PillBox; headline: TextBox; subline: TextBox }

/** Type scale per format, from the Canva designs (Quicksand; 1 Canva pt = 1.333 px at 1080 px wide).
    size = px / 1080 (fraction of the width); lineHeight = measured line pitch in em; top = how far the
    CSS line box starts above the ascender line, in em (Quicksand ascent 1.0 / descent 0.25, ascender ≈ 0.73). */
export interface TypeSpec { size: number; weight: 600 | 700; lineHeight: number; top: number }
export interface PillSpec { size: number; padX: number; radius: number; tracking: number }
export const TYPE: Record<Format, { eyebrow: PillSpec; headline: TypeSpec; subline: TypeSpec }> = {
  sq: {
    eyebrow: { size: 27 / 1080, padX: 0.03, radius: 10 / 1080, tracking: 0.04 },            // 20 pt
    headline: { size: 66.67 / 1080, weight: 700, lineHeight: 1.09, top: 0.19 },            // 50 pt bold
    subline: { size: 40 / 1080, weight: 600, lineHeight: 1.11, top: 0.2 },                  // 30 pt semibold
  },
  st: {
    eyebrow: { size: 41 / 1080, padX: 0.03, radius: 10 / 1080, tracking: 0.04 },            // 31 pt
    headline: { size: 73.33 / 1080, weight: 700, lineHeight: 1.0, top: 0.145 },            // 55 pt bold
    subline: { size: 49.33 / 1080, weight: 600, lineHeight: 1.1, top: 0.195 },             // 37 pt semibold
  },
};

// Squares: 134 px left margin, pill 62 px tall. Top layouts put the pill at y 127 px.
// w = headline box width, sw = subline box width (the narrow columns use a narrower subline box).
const SQ = (o: { px?: number; py: number; hy: number; sy: number; w?: number; sw?: number }): LayoutBoxes => ({
  eyebrow: { x: o.px ?? 0.124, y: o.py, w: 0, h: 0.0575 },
  headline: { x: o.px ?? 0.124, y: o.hy, w: o.w ?? 0.75 },
  subline: { x: o.px ?? 0.124, y: o.sy, w: o.sw ?? o.w ?? 0.75 },
});
const SQUARE: Record<string, LayoutBoxes> = {
  health: SQ({ py: 0.099, hy: 0.234, sy: 0.545, w: 0.36, sw: 0.355 }),  // narrow left column, photo blob right
  beauty: SQ({ px: 0.5425, py: 0.096, hy: 0.211, sy: 0.494, w: 0.34 }), // right column
  fitness: SQ({ py: 0.1175, hy: 0.209, sy: 0.3675 }),
  home: SQ({ py: 0.4725, hy: 0.56, sy: 0.719 }),                        // bottom band
  professional: SQ({ py: 0.1175, hy: 0.209, sy: 0.364 }),
  education: SQ({ py: 0.475, hy: 0.564, sy: 0.749 }),                   // lower band
  pets: SQ({ py: 0.1175, hy: 0.209, sy: 0.359 }),
  auto: SQ({ py: 0.1175, hy: 0.209, sy: 0.359 }),
  events: SQ({ py: 0.1175, hy: 0.209, sy: 0.535, w: 0.42, sw: 0.36 }),  // narrow left column, frame right
  food: SQ({ py: 0.1175, hy: 0.209, sy: 0.529, w: 0.38, sw: 0.32 }),    // narrow left column
  rentals: SQ({ py: 0.1, hy: 0.545, sy: 0.715 }),                       // pill top, text bottom
  hospitality: SQ({ py: 0.1175, hy: 0.216, sy: 0.5375, w: 0.42, sw: 0.3 }), // narrow left column
};

// Stories: 108 px left margin, pill 82 px tall, text column 864 px wide.
const ST = (o: { px?: number; py: number; hy: number; sy: number; w?: number }): LayoutBoxes => ({
  eyebrow: { x: o.px ?? 0.1, y: o.py, w: 0, h: 0.0425 },
  headline: { x: o.px ?? 0.1, y: o.hy, w: o.w ?? 0.8 },
  subline: { x: o.px ?? 0.1, y: o.sy, w: o.w ?? 0.8 },
});
const STORY: Record<string, LayoutBoxes> = {
  health: ST({ px: 0.129, py: 0.11375, hy: 0.1875, sy: 0.29, w: 0.74 }),
  beauty: ST({ py: 0.11375, hy: 0.185, sy: 0.295 }),
  fitness: ST({ py: 0.11375, hy: 0.205, sy: 0.331 }),
  home: ST({ py: 0.544, hy: 0.631, sy: 0.745 }),
  professional: ST({ py: 0.11375, hy: 0.191, sy: 0.311 }),
  education: ST({ py: 0.51, hy: 0.586, sy: 0.735 }),
  pets: ST({ py: 0.11375, hy: 0.191, sy: 0.31 }),
  auto: ST({ py: 0.11375, hy: 0.191, sy: 0.316 }),
  events: ST({ py: 0.11375, hy: 0.191, sy: 0.295 }),
  food: ST({ py: 0.11375, hy: 0.191, sy: 0.316 }),
  rentals: ST({ py: 0.51, hy: 0.604, sy: 0.729 }),
  hospitality: ST({ py: 0.11375, hy: 0.191, sy: 0.321 }),
};

export function boxesFor(layout: string, format: Format): LayoutBoxes {
  if (format === 'st') return STORY[layout] ?? STORY.auto!;
  return SQUARE[layout] ?? SQUARE.auto!;
}
