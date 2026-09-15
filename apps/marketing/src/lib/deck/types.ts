/* eslint-disable @typescript-eslint/no-explicit-any */
// Deck CMS shared types. Slides live in the deck_slides table as
// (deck, position, template, content jsonb); templates below turn content
// into the exact HTML the hand-built static decks used to serve.

export type DeckId = 'tenant' | 'whitelabel';

/** Bilingual value (tenant deck). Whitelabel fields are plain strings. */
export interface Bi {
  en: string;
  sr: string;
}

export interface WellDef {
  name: string;
  fit: 'cover' | 'flow';
  label: string;
}

export type FieldKind = 'text' | 'area' | 'bool' | 'select' | 'list' | 'lines';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  bilingual?: boolean;
  options?: string[]; // kind: select
  item?: FieldDef[]; // kind: list — subfields of each entry
  optional?: boolean;
}

export interface TemplateDef {
  id: string;
  name: string;
  fields: FieldDef[];
  wells: WellDef[];
  /** Default content used when adding a new slide of this template. */
  blank: Record<string, unknown>;
  /** Renders the full <section class="slide ...">...</section>. */
  render: (content: Record<string, any>) => string;
}

export interface SlideRow {
  id: string;
  deck: DeckId;
  position: number;
  template: string;
  content: Record<string, any>;
}
