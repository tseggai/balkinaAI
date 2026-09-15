/* eslint-disable @typescript-eslint/no-explicit-any */
// White-label deck (balkina.ai/deck) — dark luxury serif look, EN/CG bilingual.
// Render functions reproduce the hand-built static deck markup exactly; legacy
// plain-string content renders identically in both languages via bi().
import type { TemplateDef } from './types';
import { esc, bi, biLines, ed, dual, dualSpan, dualWrap, wellAttrs, wellHidden, wellLabel } from './html';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function bgWell(name: string, label: string, c: any): string {
  if (wellHidden(c, name)) return '';
  const w = wellAttrs(name, 'cover', c?.media, 'bgwell');
  return `<div class="${w.cls}"${w.attrs} data-label="${esc(wellLabel(c, name, label))}">${w.media}</div>`;
}

function flowWell(name: string, label: string, c: any): string {
  if (wellHidden(c, name)) return '';
  const w = wellAttrs(name, 'flow', c?.media, 'img-well');
  return `<div class="${w.cls}"${w.attrs} data-label="${esc(wellLabel(c, name, label))}">${w.media}</div>`;
}

function pointsList(points: any[], key = 'points'): string {
  return `<ul class="points">${(points || [])
    .map(
      (p, i) =>
        `<li class="en"${ed(`${key}.${i}`)}><strong>${esc(bi(p?.strong).en)}</strong> ${esc(bi(p?.text).en)}</li>` +
        `<li class="sr"${ed(`${key}.${i}`)}><strong>${esc(bi(p?.strong).sr)}</strong> ${esc(bi(p?.text).sr)}</li>`
    )
    .join('\n      ')}</ul>`;
}

function kicker(v: unknown, key = 'kicker'): string {
  const b = bi(v);
  return b.en || b.sr ? dual('p', v, 'kicker', key) : '';
}

function eyebrow(v: unknown): string {
  return `<p class="eyebrow"${ed('eyebrow')}>${dualSpan(v)}</p>`;
}

function bi0(v: unknown): string {
  const b = bi(v);
  return b.en || b.sr;
}

const WHO: Record<string, { en: string; sr: string }> = {
  guest: { en: 'Guest', sr: 'Gost' },
  concierge: { en: 'Concierge', sr: 'Konsijerž' },
};

const POINT_ITEM = [
  { key: 'strong', label: 'Bold lead', kind: 'text' as const, bilingual: true },
  { key: 'text', label: 'Text', kind: 'area' as const, bilingual: true },
];

export const WHITELABEL_TEMPLATES: TemplateDef[] = [
  {
    id: 'wl-cover',
    category: 'COVER',
    name: 'Cover',
    fields: [
      { key: 'mark', label: 'Top mark', kind: 'text', bilingual: true },
      { key: 'title', label: 'Headline (one line per row; last line is gold)', kind: 'area', bilingual: true },
      { key: 'sub', label: 'Subtitle', kind: 'area', bilingual: true },
    ],
    wells: [{ name: 'cover-bg', fit: 'cover', label: 'Photography: property hero, marina at dusk (full-bleed)' }],
    blank: { mark: 'Balkina AI · White Label', title: 'Your property.\nYour app.\nOne concierge.', sub: '' },
    render: (c) => {
      const h1 = (text: string) => {
        const lines = text.split('\n').filter(Boolean);
        const last = lines.length > 1 ? lines.pop() : null;
        return lines.map(esc).join('<br>') + (last ? `${lines.length ? '<br>' : ''}<em class="gd">${esc(last)}</em>` : '');
      };
      const t = bi(c.title);
      return `<section class="slide" aria-label="Cover">
  ${bgWell('cover-bg', 'Property hero photography', c)}
  <div class="inner">
    <div class="cover-mark"${ed('mark')}>${dualSpan(c.mark)}</div>
    <h1 class="en"${ed('title')}>${h1(t.en)}</h1><h1 class="sr"${ed('title')}>${h1(t.sr)}</h1>
    <div class="cover-rule"></div>
    ${dual('p', c.sub, 'cover-sub', 'sub')}
  </div>
</section>`;
    },
  },
  {
    id: 'wl-premise',
    category: 'PREMISE',
    name: 'Premise (lede + catalogue)',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'area', bilingual: true },
      { key: 'catalogue', label: 'Catalogue words (one per line)', kind: 'lines', bilingual: true },
    ],
    wells: [{ name: 'premise-photo', fit: 'flow', label: 'Photography: wide destination shot - promenade with venues' }],
    blank: { eyebrow: 'The Premise', title: '', lede: '', catalogue: [] },
    render: (c) => {
      const cat = biLines(c.catalogue);
      return `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    ${dual('h2', c.title, '', 'title', true)}
    ${dual('p', c.lede, 'lede', 'lede')}
    ${dualWrap('div', 'catalogue', 'catalogue', (l) => cat[l].map((s) => `<span>${esc(s)}</span>`).join(''))}
    ${flowWell('premise-photo', 'Photography', c)}
  </div>
</section>`;
    },
  },
  {
    id: 'wl-gaps',
    category: 'PROBLEM',
    name: 'Three numbered gaps',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      {
        key: 'gaps',
        label: 'Numbered items',
        kind: 'list',
        itemLabel: 'item',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text', bilingual: true },
          { key: 'text', label: 'Text', kind: 'area', bilingual: true },
        ],
      },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', bilingual: true, optional: true },
    ],
    wells: [],
    blank: { eyebrow: '', title: '', gaps: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    ${dual('h2', c.title, '', 'title', true)}
    <div class="gaps">
      ${(c.gaps || [])
        .map(
          (g: any, i: number) => `<div class="gap"${ed(`gaps.${i}`)}>
        <div class="n">${ROMAN[i] || i + 1}</div>
        ${dual('h3', g?.heading)}
        ${dual('p', g?.text)}
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
    category: 'THESIS',
    name: 'Two audience cards (Thesis)',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      {
        key: 'cards',
        label: 'Cards (first two get image wells)',
        kind: 'list',
        itemLabel: 'card',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text', bilingual: true },
          { key: 'text', label: 'Text', kind: 'area', bilingual: true },
        ],
      },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', bilingual: true, optional: true },
    ],
    wells: [
      { name: 'thesis-a', fit: 'flow', label: 'Photo: a tenant at work (barista, therapist, chef)' },
      { name: 'thesis-b', fit: 'flow', label: 'Photo: residents at leisure on the property' },
    ],
    blank: { eyebrow: 'Our Thesis', title: '', cards: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    ${dual('h2', c.title, '', 'title', true)}
    <div class="duo">
      ${(c.cards || [])
        .map(
          (card: any, i: number) => `<div class="card"${ed(`cards.${i}`)}>
        <div class="rn">${ROMAN[i] || i + 1}</div>
        ${dual('h3', card?.heading)}
        ${dual('p', card?.text)}
        ${i === 0 ? flowWell('thesis-a', 'Photo', c) : i === 1 ? flowWell('thesis-b', 'Photo', c) : ''}
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
    category: 'SECTION',
    name: 'Chapter divider',
    fields: [
      { key: 'numeral', label: 'Big numeral (I, II…)', kind: 'text' },
      { key: 'chapter', label: 'Chapter label', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title (line breaks kept)', kind: 'area', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'text', bilingual: true },
    ],
    wells: [{ name: 'bg', fit: 'cover', label: 'Photography: full-bleed background (auto-dimmed)' }],
    blank: { numeral: 'I', chapter: 'Chapter One', title: '', lede: '' },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.chapter))} divider">
  ${bgWell('bg', 'Background photography', c)}
  <div class="inner divider">
    <div class="big" aria-hidden="true"${ed('numeral')}>${esc(c.numeral)}</div>
    <div class="chapter"${ed('chapter')}>${dualSpan(c.chapter)}</div>
    ${dual('h2', c.title, '', 'title', true)}
    <p class="lede en" style="max-width:30em"${ed('lede')}>${esc(bi(c.lede).en)}</p><p class="lede sr" style="max-width:30em"${ed('lede')}>${esc(bi(c.lede).sr)}</p>
  </div>
</section>`,
  },
  {
    id: 'wl-points',
    category: 'FEATURE',
    name: 'Feature (text left, image right)',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      { key: 'points', label: 'Points', kind: 'list', itemLabel: 'bullet', item: POINT_ITEM },
      { key: 'kicker', label: 'Italic gold kicker (optional)', kind: 'text', bilingual: true, optional: true },
    ],
    wells: [{ name: 'shot', fit: 'flow', label: 'Screenshot / photography for this slide' }],
    blank: { eyebrow: '', title: '', points: [], kicker: '' },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="cols">
      <div>
        ${dual('h2', c.title, '', 'title', true)}
        ${pointsList(c.points)}
        ${kicker(c.kicker)}
      </div>
      <div class="feature-media">
        ${flowWell('shot', 'Screenshot / photo', c)}
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'wl-chat',
    category: 'FEATURE',
    name: 'Points + concierge chat',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      { key: 'points', label: 'Points', kind: 'list', itemLabel: 'bullet', item: POINT_ITEM },
      {
        key: 'msgs',
        label: 'Chat messages',
        kind: 'list',
        itemLabel: 'message',
        item: [
          { key: 'who', label: 'Sender', kind: 'select', options: ['guest', 'concierge'] },
          { key: 'text', label: 'Message', kind: 'area', bilingual: true },
        ],
      },
    ],
    wells: [{ name: 'media', fit: 'flow', label: 'Screen recording: booking in the branded app (replaces the chat mock)' }],
    blank: { eyebrow: '', title: '', points: [], msgs: [] },
    render: (c) => {
      const w = wellAttrs('media', 'flow', c.media, 'chat');
      const msgs = (c.msgs || [])
        .map((m: any, i: number) => {
          const who = m?.who === 'concierge' ? 'concierge' : 'guest';
          return `<div class="bubble ${who}"${ed(`msgs.${i}`)}><span class="who">${dualSpan(WHO[who])}</span>${dualSpan(m?.text)}</div>`;
        })
        .join('\n        ');
      return `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="cols">
      <div>
        ${dual('h2', c.title, '', 'title', true)}
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
    category: 'COMPARISON',
    name: 'Three-way comparison',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      {
        key: 'options',
        label: 'Options',
        kind: 'list',
        itemLabel: 'option',
        item: [
          { key: 'heading', label: 'Heading', kind: 'text', bilingual: true },
          { key: 'items', label: 'Lines (one per row)', kind: 'lines', bilingual: true },
          { key: 'best', label: 'Mark as “The Balkina Way”', kind: 'bool' },
        ],
      },
    ],
    wells: [],
    blank: { eyebrow: 'The Alternatives', title: '', options: [] },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    ${dual('h2', c.title, '', 'title', true)}
    <div class="compare">
      ${(c.options || [])
        .map((o: any, i: number) => {
          const lines = biLines(o?.items);
          return `<div class="option${o?.best ? ' best' : ''}"${ed(`options.${i}`)}>
        ${dual('h3', o?.heading)}
        ${dualWrap('ul', '', undefined, (l) => lines[l].map((s) => `<li>${esc(s)}</li>`).join('\n          '))}
      </div>`;
        })
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
  {
    id: 'wl-plans',
    category: 'PRICING',
    name: 'Pricing plans',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      {
        key: 'plans',
        label: 'Plans',
        kind: 'list',
        itemLabel: 'plan',
        item: [
          { key: 'name', label: 'Name', kind: 'text' },
          { key: 'price', label: 'Price (e.g. €899)', kind: 'text' },
          { key: 'per', label: 'Per label (e.g. / month)', kind: 'text', bilingual: true },
          { key: 'text', label: 'Description', kind: 'area', bilingual: true },
          { key: 'hi', label: 'Highlight', kind: 'bool' },
        ],
      },
    ],
    wells: [],
    blank: { eyebrow: 'The Engagement', title: '', plans: [] },
    render: (c) => `<section class="slide" aria-label="Pricing and launch">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    ${dual('h2', c.title, '', 'title', true)}
    <div class="plans">
      ${(c.plans || [])
        .map(
          (p: any, i: number) => `<div class="plan${p?.hi ? ' hi' : ''}"${ed(`plans.${i}`)}>
        <div class="name">${esc(p?.name)}</div>
        <div class="price">${esc(p?.price)}${bi0(p?.per) ? ` <small>${dualSpan(p?.per)}</small>` : ''}</div>
        ${dual('p', p?.text)}
      </div>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
  {
    id: 'wl-proof',
    category: 'CLOSING',
    name: 'Proof + CTA buttons',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', kind: 'text', bilingual: true },
      { key: 'title_pre', label: 'Title (before highlight)', kind: 'text', bilingual: true },
      { key: 'title_em', label: 'Title highlight (gold italic)', kind: 'text', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'area', bilingual: true },
      {
        key: 'buttons',
        label: 'Buttons',
        kind: 'list',
        itemLabel: 'button',
        item: [
          { key: 'label', label: 'Label', kind: 'text', bilingual: true },
          { key: 'url', label: 'URL', kind: 'text' },
          { key: 'style', label: 'Style', kind: 'select', options: ['gold', 'line'] },
        ],
      },
    ],
    wells: [{ name: 'proof-photo', fit: 'flow', label: 'Photography: Portonovi + branded app screenshot' }],
    blank: { eyebrow: 'In the World', title_pre: '', title_em: '', lede: '', buttons: [] },
    render: (c) => `<section class="slide" aria-label="Proof and next step">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <h2 class="en"${ed('title_pre')}>${esc(bi(c.title_pre).en)} <em class="gd"${ed('title_em')}>${esc(bi(c.title_em).en)}</em>.</h2>
    <h2 class="sr"${ed('title_pre')}>${esc(bi(c.title_pre).sr)} <em class="gd"${ed('title_em')}>${esc(bi(c.title_em).sr)}</em>.</h2>
    ${dual('p', c.lede, 'lede', 'lede')}
    ${flowWell('proof-photo', 'Photography', c)}
    <div class="cta-row">
      ${(c.buttons || [])
        .map(
          (b: any, i: number) =>
            `<a class="btn ${b?.style === 'line' ? 'line' : 'gold'}" href="${esc(b?.url)}" target="_blank" rel="noopener"${ed(`buttons.${i}`)}>${dualSpan(b?.label)}</a>`
        )
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
];
