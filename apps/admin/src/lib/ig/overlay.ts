/* Where the text sits on each category template, as a fraction of the image. Drives the editable
   preview in the studio: the copy is laid over a text-free render of the template in these boxes.
   Approximate by design — the Canva render is the truth; adjust here when a template changes. */

export interface TextBox { x: number; y: number; w: number; size: number; align?: 'left' | 'right' | 'center' }
export interface LayoutBoxes { eyebrow: TextBox; headline: TextBox; subline: TextBox }
export type Format = 'sq' | 'st';

// size = font size as a fraction of the image width.
const LEFT_COLUMN: LayoutBoxes = { eyebrow: { x: 0.12, y: 0.105, w: 0.36, size: 0.022 }, headline: { x: 0.12, y: 0.19, w: 0.36, size: 0.066 }, subline: { x: 0.12, y: 0.56, w: 0.36, size: 0.03 } };
const RIGHT_COLUMN: LayoutBoxes = { eyebrow: { x: 0.54, y: 0.105, w: 0.36, size: 0.022 }, headline: { x: 0.54, y: 0.19, w: 0.36, size: 0.066 }, subline: { x: 0.54, y: 0.66, w: 0.36, size: 0.03 } };
const TOP_WIDE: LayoutBoxes = { eyebrow: { x: 0.12, y: 0.115, w: 0.76, size: 0.022 }, headline: { x: 0.12, y: 0.195, w: 0.76, size: 0.066 }, subline: { x: 0.12, y: 0.35, w: 0.76, size: 0.03 } };
const BOTTOM_WIDE: LayoutBoxes = { eyebrow: { x: 0.12, y: 0.51, w: 0.76, size: 0.022 }, headline: { x: 0.12, y: 0.59, w: 0.76, size: 0.066 }, subline: { x: 0.12, y: 0.74, w: 0.76, size: 0.03 } };
const BOTTOM_LOW: LayoutBoxes = { eyebrow: { x: 0.12, y: 0.48, w: 0.76, size: 0.022 }, headline: { x: 0.12, y: 0.56, w: 0.76, size: 0.066 }, subline: { x: 0.12, y: 0.71, w: 0.76, size: 0.03 } };
const RENTALS: LayoutBoxes = { eyebrow: { x: 0.12, y: 0.11, w: 0.76, size: 0.022 }, headline: { x: 0.12, y: 0.54, w: 0.76, size: 0.066 }, subline: { x: 0.12, y: 0.71, w: 0.76, size: 0.03 } };

const SQUARE: Record<string, LayoutBoxes> = {
  health: LEFT_COLUMN,
  beauty: RIGHT_COLUMN,
  fitness: TOP_WIDE,
  home: BOTTOM_WIDE,
  professional: TOP_WIDE,
  education: BOTTOM_LOW,
  pets: TOP_WIDE,
  auto: TOP_WIDE,
  events: { ...LEFT_COLUMN, headline: { x: 0.12, y: 0.19, w: 0.4, size: 0.066 }, subline: { x: 0.12, y: 0.49, w: 0.36, size: 0.03 } },
  food: { ...LEFT_COLUMN, headline: { x: 0.12, y: 0.19, w: 0.4, size: 0.066 }, subline: { x: 0.12, y: 0.49, w: 0.36, size: 0.03 } },
  rentals: RENTALS,
  hospitality: TOP_WIDE,
};

/** Story (9:16): the story templates put the text in a wide band in the lower middle, whatever the square does. */
const STORY: LayoutBoxes = { eyebrow: { x: 0.1, y: 0.56, w: 0.8, size: 0.03 }, headline: { x: 0.1, y: 0.62, w: 0.8, size: 0.078 }, subline: { x: 0.1, y: 0.8, w: 0.8, size: 0.036 } };
const STORY_TOP: LayoutBoxes = { eyebrow: { x: 0.1, y: 0.1, w: 0.8, size: 0.03 }, headline: { x: 0.1, y: 0.16, w: 0.8, size: 0.078 }, subline: { x: 0.1, y: 0.34, w: 0.8, size: 0.036 } };
const STORY_BY_LAYOUT: Record<string, LayoutBoxes> = { fitness: STORY_TOP, professional: STORY_TOP, pets: STORY_TOP, auto: STORY_TOP };

export function boxesFor(layout: string, format: Format): LayoutBoxes {
  if (format === 'st') return STORY_BY_LAYOUT[layout] ?? STORY;
  return SQUARE[layout] ?? TOP_WIDE;
}
