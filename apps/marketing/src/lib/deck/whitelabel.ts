/* eslint-disable @typescript-eslint/no-explicit-any */
// White-label deck (balkina.ai/deck) — dark luxury serif look, English only.
// Render functions reproduce the hand-built static deck markup exactly.
import type { TemplateDef } from './types';
import { esc, wellAttrs } from './html';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Escape + preserve intentional line breaks in titles. */
function escBr(s: unknown): string {
  return esc(s).replace(/\n/g, '<br>');
}

function bgWell(name: string, label: string, media: Record<string, string> | undefined): string {
  const w = wellAttrs(name, 'cover', media, 'bgwell');
  return `<div class="${w.cls}"${w.attrs} data-label="${esc(label)}">${w.media}</div>`;
}

function flowWell(name: string, label: string, media: Record<string, string> | undefined): string {
  const w = wellAttrs(name, 'flow', media, 'img-well');
  return `<div class="${w.cls}"${w.attrs} data-label="${esc(label)}">${w.media}</div>`;
}

function pointsList(points: any[]): string {
  return `<ul class="points">${(points || [])
    .map((p) => `<li><strong>${esc(p?.strong)}</strong> ${esc(p?.text)}</li>`)
    .join('\n      ')}</ul>`;
}

function kicker(v: unknown): string {
  return v ? `<p class="kicker">${esc(v)}</p>` : '';
}

export const WHITELABEL_TEMPLATES: TemplateDef[] = [
  {
    id: 'wl-cover',
    name: 'Cover',
    fields: [
      { key: 'mark', label: 'Top mark', kind: 'text' },
      { key: 'title', label: 'Headline (one line per row; last line is gold)', kind: 'area' },
      { key: 'sub', label: 'Subtitle', kind: 'area' },
    ],
    wells: [{ name: 'cover-bg', fit: 'cover', label: 'Photography: property hero, marina at dusk (full-bleed)' }],
    blank: { mark: 'Balkina AI · White Label', title: 'Your property.\nYour app.\nOne concierge.', sub: '' },
    render: (c) => {
      const lines = String(c.title ?? '').split('\n').filter(Boolean);
      const last = lines.length > 1 ? lines.pop() : null;
      const h1 = lines.map(esc).join('<br>') + (last ? `${lines.length ? '<br>' : ''}<em class="gd">${esc(last)}</em>` : '');
      return `<section class="slide" aria-label="Cover">
  ${bgWell('cover-bg', 'Property hero photography', c.media)}
  <div class="inner">
    <div class="cover-mark">${esc(c.mark)}</div>
    <h1>${h1}</h1>
    <div class="cover-rule"></div>
    <p class="cover-sub">${esc(c.sub)}</p>
  </div>
</section>`;
    },
  },
  {
    id: 'wl-premise',
    name: 'Premise (lede + catalogue)',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'area' },
      { key: 'catalogue', label: 'Catalogue words (one per line)', kind: 'lines' },
    ],
    wells: [{ name: 'premise-photo', fit: 'flow', label: 'Photography: wide destination shot - promenade with venues' }],
    blank: { eyebrow: 'The Premise', title: '', lede: '', catalogue: [] },
    render: (c) => `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    <p class="lede">${esc(c.lede)}</p>
    <div class="catalogue">
      ${(c.catalogue || []).map((s: string) => `<span>${esc(s)}</span>`).join('')}
    </div>
    ${flowWell('premise-photo', 'Photography', c.media)}
  </div>
</section>`,
  },
  {
    id: 'wl-gaps',
    name: 'Three numbered gaps',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'gaps',
        label: 'Numbered items',
        kind: 'list',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text' },
          { key: 'text', label: 'Text', kind: 'area' },
        ],
      },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', optional: true },
    ],
    wells: [],
    blank: { eyebrow: '', title: '', gaps: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    <div class="gaps">
      ${(c.gaps || [])
        .map(
          (g: any, i: number) => `<div class="gap">
        <div class="n">${ROMAN[i] || i + 1}</div>
        <h3>${esc(g?.heading)}</h3>
        <p>${esc(g?.text)}</p>
      </div>`
        )
        .join('\n      ')}
    </div>
    ${kicker(c.kicker)}
  </div>
</section>`,
  },
  {
    id: 'wl-duo',
    name: 'Two audience cards (Thesis)',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'cards',
        label: 'Cards (first two get image wells)',
        kind: 'list',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text' },
          { key: 'text', label: 'Text', kind: 'area' },
        ],
      },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', optional: true },
    ],
    wells: [
      { name: 'thesis-a', fit: 'flow', label: 'Photo: a tenant at work (barista, therapist, chef)' },
      { name: 'thesis-b', fit: 'flow', label: 'Photo: residents at leisure on the property' },
    ],
    blank: { eyebrow: 'Our Thesis', title: '', cards: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    <div class="duo">
      ${(c.cards || [])
        .map(
          (card: any, i: number) => `<div class="card">
        <div class="rn">${ROMAN[i] || i + 1}</div>
        <h3>${esc(card?.heading)}</h3>
        <p>${esc(card?.text)}</p>
        ${i === 0 ? flowWell('thesis-a', 'Photo', c.media) : i === 1 ? flowWell('thesis-b', 'Photo', c.media) : ''}
      </div>`
        )
        .join('\n      ')}
    </div>
    ${kicker(c.kicker)}
  </div>
</section>`,
  },
  {
    id: 'wl-divider',
    name: 'Chapter divider',
    fields: [
      { key: 'numeral', label: 'Big numeral (I, II…)', kind: 'text' },
      { key: 'chapter', label: 'Chapter label', kind: 'text' },
      { key: 'title', label: 'Title (line breaks kept)', kind: 'area' },
      { key: 'lede', label: 'Lede', kind: 'text' },
    ],
    wells: [{ name: 'bg', fit: 'cover', label: 'Photography: full-bleed background (auto-dimmed)' }],
    blank: { numeral: 'I', chapter: 'Chapter One', title: '', lede: '' },
    render: (c) => `<section class="slide" aria-label="${esc(c.chapter)} divider">
  ${bgWell('bg', 'Background photography', c.media)}
  <div class="inner divider">
    <div class="big" aria-hidden="true">${esc(c.numeral)}</div>
    <div class="chapter">${esc(c.chapter)}</div>
    <h2>${escBr(c.title)}</h2>
    <p class="lede" style="max-width:30em">${esc(c.lede)}</p>
  </div>
</section>`,
  },
  {
    id: 'wl-points',
    name: 'Title + bullet points',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'points',
        label: 'Points',
        kind: 'list',
        item: [
          { key: 'strong', label: 'Bold lead', kind: 'text' },
          { key: 'text', label: 'Text', kind: 'area' },
        ],
      },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', optional: true },
    ],
    wells: [{ name: 'shot', fit: 'flow', label: 'Screenshot / photography for this slide' }],
    blank: { eyebrow: '', title: '', points: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    ${pointsList(c.points)}
    ${flowWell('shot', 'Screenshot / photo', c.media)}
    ${kicker(c.kicker)}
  </div>
</section>`,
  },
  {
    id: 'wl-chat',
    name: 'Points + concierge chat',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'points',
        label: 'Points',
        kind: 'list',
        item: [
          { key: 'strong', label: 'Bold lead', kind: 'text' },
          { key: 'text', label: 'Text', kind: 'area' },
        ],
      },
      {
        key: 'msgs',
        label: 'Chat messages',
        kind: 'list',
        item: [
          { key: 'who', label: 'Sender', kind: 'select', options: ['guest', 'concierge'] },
          { key: 'text', label: 'Message', kind: 'area' },
        ],
      },
    ],
    wells: [{ name: 'media', fit: 'flow', label: 'Screen recording: booking in the branded app (replaces the chat mock)' }],
    blank: { eyebrow: '', title: '', points: [], msgs: [] },
    render: (c) => {
      const w = wellAttrs('media', 'flow', c.media, 'chat');
      const msgs = (c.msgs || [])
        .map((m: any) => {
          const who = m?.who === 'concierge' ? 'concierge' : 'guest';
          const label = who === 'concierge' ? 'Concierge' : 'Guest';
          return `<div class="bubble ${who}"><span class="who">${label}</span>${esc(m?.text)}</div>`;
        })
        .join('\n        ');
      return `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <div class="cols">
      <div>
        <h2>${escBr(c.title)}</h2>
        ${pointsList(c.points)}
      </div>
      <div class="${w.cls}"${w.attrs} aria-label="Example conversation">
        ${msgs}${w.media}
      </div>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: 'wl-compare',
    name: 'Three-way comparison',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'options',
        label: 'Options',
        kind: 'list',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text' },
          { key: 'items', label: 'Lines (one per row)', kind: 'lines' },
          { key: 'best', label: 'Mark as “The Balkina Way”', kind: 'bool' },
        ],
      },
    ],
    wells: [],
    blank: { eyebrow: 'The Alternatives', title: '', options: [] },
    render: (c) => `<section class="slide" aria-label="${esc(c.eyebrow)}">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    <div class="compare">
      ${(c.options || [])
        .map(
          (o: any) => `<div class="option${o?.best ? ' best' : ''}">
        <h3>${esc(o?.heading)}</h3>
        <ul>
          ${(o?.items || []).map((s: string) => `<li>${esc(s)}</li>`).join('\n          ')}
        </ul>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
  {
    id: 'wl-plans',
    name: 'Pricing plans',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title', label: 'Title', kind: 'text' },
      {
        key: 'plans',
        label: 'Plans',
        kind: 'list',
        item: [
          { key: 'name', label: 'Name', kind: 'text' },
          { key: 'price', label: 'Price (e.g. €899)', kind: 'text' },
          { key: 'per', label: 'Per label (e.g. / month)', kind: 'text' },
          { key: 'text', label: 'Description', kind: 'area' },
          { key: 'hi', label: 'Highlight', kind: 'bool' },
        ],
      },
    ],
    wells: [],
    blank: { eyebrow: 'The Engagement', title: '', plans: [] },
    render: (c) => `<section class="slide" aria-label="Pricing and launch">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${escBr(c.title)}</h2>
    <div class="plans">
      ${(c.plans || [])
        .map(
          (p: any) => `<div class="plan${p?.hi ? ' hi' : ''}">
        <div class="name">${esc(p?.name)}</div>
        <div class="price">${esc(p?.price)}${p?.per ? ` <small>${esc(p?.per)}</small>` : ''}</div>
        <p>${esc(p?.text)}</p>
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
  {
    id: 'wl-proof',
    name: 'Proof + CTA buttons',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text' },
      { key: 'title_pre', label: 'Title (before highlight)', kind: 'text' },
      { key: 'title_em', label: 'Title highlight (gold italic)', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'area' },
      {
        key: 'buttons',
        label: 'Buttons',
        kind: 'list',
        item: [
          { key: 'label', label: 'Label', kind: 'text' },
          { key: 'url', label: 'URL', kind: 'text' },
          { key: 'style', label: 'Style', kind: 'select', options: ['gold', 'line'] },
        ],
      },
    ],
    wells: [{ name: 'proof-photo', fit: 'flow', label: 'Photography: Portonovi + branded app screenshot' }],
    blank: { eyebrow: 'In the World', title_pre: '', title_em: '', lede: '', buttons: [] },
    render: (c) => `<section class="slide" aria-label="Proof and next step">
  <div class="inner">
    <p class="eyebrow">${esc(c.eyebrow)}</p>
    <h2>${esc(c.title_pre)} <em class="gd">${esc(c.title_em)}</em>.</h2>
    <p class="lede">${esc(c.lede)}</p>
    ${flowWell('proof-photo', 'Photography', c.media)}
    <div class="cta-row">
      ${(c.buttons || [])
        .map(
          (b: any) =>
            `<a class="btn ${b?.style === 'line' ? 'line' : 'gold'}" href="${esc(b?.url)}" target="_blank" rel="noopener">${esc(b?.label)}</a>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
];
