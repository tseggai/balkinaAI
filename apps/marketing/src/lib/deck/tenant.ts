/* eslint-disable @typescript-eslint/no-explicit-any */
// Tenant deck (balkina.ai/tenant-deck) — bilingual EN/SR, navy/yellow Quicksand look.
// Render functions reproduce the hand-built static deck markup exactly.
import type { TemplateDef } from './types';
import { esc, bi, ed, dual, dualSpan, wellAttrs, LOGO_WHITE, USER_AVATAR_SVG, APPLE_SVG, GPLAY_SVG } from './html';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/* ------------------------------------------------------------------ */
/* Fixed CSS mock fragments (fallback art when no image is uploaded)  */
/* ------------------------------------------------------------------ */

const IPAD_MOCK = `
              <div class="dash-top"><b>Balkina</b><span class="en">This week</span><span class="sr">Ova nedelja</span></div>
              <div class="week">
                <div class="day"><b class="en">Mon</b><b class="sr">Pon</b><div class="evt a">Ana · 9:00</div><div class="evt b">Luka · 10:30</div><div class="evt c">Mia · 13:00</div></div>
                <div class="day"><b class="en">Tue</b><b class="sr">Uto</b><div class="evt b">Ivan · 9:30</div><div class="evt y">Team · 12:00</div><div class="evt a">Sara · 15:00</div><div class="evt c">Nik · 17:30</div></div>
                <div class="day"><b class="en">Wed</b><b class="sr">Sre</b><div class="evt c">Maja · 10:00</div><div class="evt a">Vuk · 11:30</div></div>
                <div class="day"><b class="en">Thu</b><b class="sr">Čet</b><div class="evt a">Ena · 9:00</div><div class="evt b">Filip · 12:30</div><div class="evt y">VIP · 16:00</div></div>
                <div class="day"><b class="en">Fri</b><b class="sr">Pet</b><div class="evt b">Tara · 10:00</div><div class="evt c">Aleks · 13:30</div><div class="evt a">Lena · 18:00</div></div>
              </div>`;

const IPHONE_MOCK = `
              <p class="ph-title"><span class="en">Bookings</span><span class="sr">Rezervacije</span></p>
              <div class="ph-card">
                <div class="ph-row">
                  <span class="ph-nm">Ana P.</span>
                  <span class="ph-chip"><span class="en">Confirmed</span><span class="sr">Potvrđeno</span></span>
                </div>
                <div class="ph-svc"><span class="en">Cut &amp; beard — 45 min</span><span class="sr">Šišanje i brada — 45 min</span></div>
                <div class="ph-meta"><span class="en">Tomorrow 5:30 PM</span><span class="sr">Sutra 17:30</span></div>
                <div class="ph-actions">
                  <span class="ph-act g"><span class="en">Complete</span><span class="sr">Završi</span></span>
                  <span class="ph-act r"><span class="en">Cancel</span><span class="sr">Otkaži</span></span>
                </div>
              </div>
              <div class="ph-card">
                <div class="ph-row">
                  <span class="ph-nm">Stefan K.</span>
                  <span class="ph-chip"><span class="en">Pending</span><span class="sr">Na čekanju</span></span>
                </div>
                <div class="ph-svc"><span class="en">Haircut — 60 min</span><span class="sr">Šišanje — 60 min</span></div>
                <div class="ph-meta"><span class="en">Fri 8:30 PM</span><span class="sr">Pet 20:30</span></div>
              </div>`;

const CALENDAR_BOARD = `
    <div class="board">
      <div class="dash-top"><b>Balkina</b><span class="en">This week</span><span class="sr">Ova nedelja</span></div>
      <div class="week">
        <div class="day"><b class="en">Mon</b><b class="sr">Pon</b><div class="evt a">Ana · 9:00</div><div class="evt b">Luka · 10:30</div><div class="evt c">Mia · 13:00</div><div class="evt b">Iva · 16:00</div></div>
        <div class="day"><b class="en">Tue</b><b class="sr">Uto</b><div class="evt b">Ivan · 9:30</div><div class="evt y">Team · 12:00</div><div class="evt a">Sara · 15:00</div></div>
        <div class="day"><b class="en">Wed</b><b class="sr">Sre</b><div class="evt c">Maja · 10:00</div><div class="evt a">Vuk · 11:30</div><div class="evt b">Nik · 14:00</div><div class="evt a">Ema · 17:00</div></div>
        <div class="day"><b class="en">Thu</b><b class="sr">Čet</b><div class="evt a">Ena · 9:00</div><div class="evt b">Filip · 12:30</div><div class="evt y">VIP · 16:00</div></div>
        <div class="day"><b class="en">Fri</b><b class="sr">Pet</b><div class="evt b">Tara · 10:00</div><div class="evt c">Aleks · 13:30</div><div class="evt a">Lena · 18:00</div></div>
        <div class="day"><b class="en">Sat</b><b class="sr">Sub</b><div class="evt y">Brunch · 11:00</div><div class="evt a">Mila · 14:00</div><div class="evt b">Ognjen · 16:30</div></div>
        <div class="day"><b class="en">Sun</b><b class="sr">Ned</b><div class="evt c">Đorđe · 12:00</div><div class="evt a">Nina · 15:30</div></div>
      </div>
    </div>`;

const BOOKING_BOARD = `
    <div class="bookmock">
      <div class="bm-head"><span class="en">Old Town Barbers</span><span class="sr">Berbernica Stari grad</span><span>★ 4.9 (127)</span></div>
      <div class="bm-svc"><span class="en">Cut &amp; beard trim · 45 min</span><span class="sr">Šišanje i brada · 45 min</span><i>€18</i></div>
      <div class="bm-svc"><span class="en">Haircut · 60 min</span><span class="sr">Šišanje · 60 min</span><i>€15</i></div>
      <div class="slots">
        <span class="slot">15:00</span><span class="slot">15:45</span><span class="slot on">17:30</span>
        <span class="slot">18:15</span><span class="slot">19:00</span><span class="slot">19:45</span>
      </div>
    </div>`;

/* ------------------------------------------------------------------ */
/* Shared render pieces                                               */
/* ------------------------------------------------------------------ */

function eyebrow(v: unknown): string {
  return `<p class="eyebrow"${ed('eyebrow')}>${dualSpan(v)}</p>`;
}

function pointsList(points: any[], key = 'points'): string {
  return `<ul class="points">${(points || [])
    .map(
      (p, i) =>
        `<li class="en"${ed(`${key}.${i}`)}><strong>${esc(p?.strong?.en)}</strong> ${esc(p?.text?.en)}</li>` +
        `<li class="sr"${ed(`${key}.${i}`)}><strong>${esc(p?.strong?.sr)}</strong> ${esc(p?.text?.sr)}</li>`
    )
    .join('\n          ')}</ul>`;
}

function flowWell(name: string, label: string, media: Record<string, string> | undefined): string {
  const w = wellAttrs(name, 'flow', media, 'img-well');
  return `<div class="${w.cls}"${w.attrs} data-label="${esc(label)}">${w.media}</div>`;
}

function kicker(v: any, key = 'kicker'): string {
  if (!v || (!v.en && !v.sr)) return '';
  return dual('p', v, 'kicker', key);
}

function bi0(v: unknown): string {
  const b = bi(v);
  return b.en || b.sr;
}

const POINT_ITEM = [
  { key: 'strong', label: 'Bold lead', kind: 'text' as const, bilingual: true },
  { key: 'text', label: 'Text', kind: 'area' as const, bilingual: true },
];

/* ------------------------------------------------------------------ */
/* Templates                                                          */
/* ------------------------------------------------------------------ */

export const TENANT_TEMPLATES: TemplateDef[] = [
  {
    id: 'cover',
    name: 'Cover (device mockups)',
    fields: [
      { key: 'mark', label: 'Top mark', kind: 'text', bilingual: true },
      { key: 'title', label: 'Headline', kind: 'area', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'area', bilingual: true },
    ],
    wells: [
      { name: 'cover-ipad', fit: 'cover', label: 'Screenshot: week calendar (iPad)' },
      { name: 'cover-iphone', fit: 'cover', label: 'Screenshot: bookings list (iPhone)' },
    ],
    blank: {
      mark: { en: 'Balkina AI · For Your Business', sr: 'Balkina AI · Za vaš biznis' },
      title: { en: 'Headline', sr: 'Naslov' },
      lede: { en: '', sr: '' },
    },
    render: (c) => {
      const ipad = wellAttrs('cover-ipad', 'cover', c.media, 'scr');
      const iphone = wellAttrs('cover-iphone', 'cover', c.media, 'scr');
      return `<section class="slide" aria-label="Cover">
  <div class="inner">
    <div class="cover-mark"${ed('mark')}>${dualSpan(c.mark)}</div>
    <div class="split">
      <div>
        ${dual('h1', c.title, '', 'title')}
        <div class="cover-rule"></div>
        ${dual('p', c.lede, 'lede', 'lede')}
      </div>
      <div>
        <div class="devices" aria-label="App preview">
          <div class="ipad">
            <div class="${ipad.cls}"${ipad.attrs}>${IPAD_MOCK}${ipad.media}</div>
          </div>
          <div class="iphone">
            <div class="${iphone.cls}"${iphone.attrs}>${IPHONE_MOCK}${iphone.media}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: 'types',
    name: 'Centered list (Built for)',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      {
        key: 'items',
        label: 'Items (alternate white/yellow automatically)',
        kind: 'list',
        itemLabel: 'item',
        item: [{ key: 'label', label: 'Item', kind: 'text', bilingual: true }],
      },
    ],
    wells: [],
    blank: { eyebrow: { en: 'Built For', sr: 'Napravljeno za' }, items: [] },
    render: (c) => `<section class="slide centered" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="types">
      ${(c.items || [])
        .map((it: any, i: number) => `<div class="t${i % 2 === 1 ? ' y' : ''}"${ed(`items.${i}`)}>${dualSpan(it?.label)}</div>`)
        .join('\n      ')}
    </div>
  </div>
</section>`,
  },
  {
    id: 'problem',
    name: 'Numbered gaps (Problem)',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'area', bilingual: true },
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
    ],
    wells: [{ name: 'challenges-photo', fit: 'flow', label: 'Photo: busy owner mid-service, phone ringing unanswered' }],
    blank: { eyebrow: { en: 'The Problem', sr: 'Problem' }, title: { en: '', sr: '' }, gaps: [] },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="split">
      <div>
        ${dual('h2', c.title, '', 'title')}
        ${flowWell('challenges-photo', 'Photo', c.media)}
      </div>
      <div>
        <div class="gaps">
          ${(c.gaps || [])
            .map(
              (g: any, i: number) => `<div class="gap"${ed(`gaps.${i}`)}>
            <div class="n">${ROMAN[i] || i + 1}</div>
            ${dual('h3', g?.heading)}
            ${dual('p', g?.text)}
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'points',
    name: 'Title + bullet points',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'area', bilingual: true },
      { key: 'points', label: 'Points', kind: 'list', itemLabel: 'bullet', item: POINT_ITEM },
      { key: 'kicker', label: 'Yellow kicker (optional)', kind: 'text', bilingual: true, optional: true },
    ],
    wells: [{ name: 'shot', fit: 'flow', label: 'Screenshot / short video for this slide' }],
    blank: { eyebrow: { en: 'Section', sr: 'Sekcija' }, title: { en: '', sr: '' }, points: [], kicker: { en: '', sr: '' } },
    render: (c) => `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="split">
      <div>
        ${dual('h2', c.title, '', 'title')}
      </div>
      <div>
        ${pointsList(c.points)}
        ${flowWell('shot', 'Screenshot / video', c.media)}
        ${kicker(c.kicker)}
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'points-chat',
    name: 'Points + chat conversation',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'area', bilingual: true },
      { key: 'points', label: 'Points', kind: 'list', itemLabel: 'bullet', item: POINT_ITEM },
      {
        key: 'msgs',
        label: 'Chat messages',
        kind: 'list',
        itemLabel: 'message',
        item: [
          { key: 'who', label: 'Sender', kind: 'select', options: ['guest', 'bot'] },
          { key: 'text', label: 'Message', kind: 'area', bilingual: true },
        ],
      },
    ],
    wells: [{ name: 'solution-media', fit: 'flow', label: 'Screen recording: chat booking, 6-8s loop (replaces the chat mock)' }],
    blank: { eyebrow: { en: 'The Solution', sr: 'Rešenje' }, title: { en: '', sr: '' }, points: [], msgs: [] },
    render: (c) => {
      const w = wellAttrs('solution-media', 'flow', c.media, 'chat');
      const msgs = (c.msgs || [])
        .map((m: any, i: number) =>
          m?.who === 'bot'
            ? `<div class="msg bot"${ed(`msgs.${i}`)}>
            <div class="avatar bot" aria-hidden="true"><img src="${LOGO_WHITE}" alt=""></div>
            <div class="bubble">${dualSpan(m?.text)}</div>
          </div>`
            : `<div class="msg guest"${ed(`msgs.${i}`)}>
            <div class="bubble">${dualSpan(m?.text)}</div>
            <div class="avatar user" aria-hidden="true">${USER_AVATAR_SVG}</div>
          </div>`
        )
        .join('\n          ');
      return `<section class="slide" aria-label="${esc(bi0(c.eyebrow))}">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="split">
      <div>
        ${dual('h2', c.title, '', 'title')}
      </div>
      <div>
        ${pointsList(c.points)}
        <div class="${w.cls}"${w.attrs} aria-label="Example conversation">
          ${msgs}${w.media}
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: 'divider',
    name: 'Section divider (app background)',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'text', bilingual: true },
      { key: 'mock', label: 'Fallback background art', kind: 'select', options: ['calendar', 'booking'] },
    ],
    wells: [{ name: 'bg', fit: 'cover', label: 'Screenshot: app background (dimmed under the blue shade)' }],
    blank: { title: { en: '', sr: '' }, lede: { en: '', sr: '' }, mock: 'calendar' },
    render: (c) => {
      const w = wellAttrs('bg', 'cover', c.media, 'appbg');
      const board = c.mock === 'booking' ? BOOKING_BOARD : CALENDAR_BOARD;
      return `<section class="slide divider" aria-label="Section: ${esc(bi0(c.title))}">
  <div class="${w.cls}"${w.attrs} aria-hidden="true">${board}${w.media}</div>
  <div class="shade"></div>
  <div class="inner">
    ${dual('h2', c.title, '', 'title')}
    ${dual('p', c.lede, 'lede', 'lede')}
  </div>
</section>`;
    },
  },
  {
    id: 'pricing',
    name: 'Pricing plans',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      { key: 'title', label: 'Title', kind: 'area', bilingual: true },
      { key: 'kicker', label: 'Yellow kicker', kind: 'text', bilingual: true },
      {
        key: 'plans',
        label: 'Plans',
        kind: 'list',
        itemLabel: 'plan',
        item: [
          { key: 'name', label: 'Name', kind: 'text' },
          { key: 'price', label: 'Price (e.g. €49)', kind: 'text' },
          { key: 'per', label: 'Per label', kind: 'text', bilingual: true },
          { key: 'aud', label: 'Audience line', kind: 'text', bilingual: true },
          { key: 'line', label: 'Limits line', kind: 'text', bilingual: true },
          { key: 'popular', label: 'Highlight as Most Popular', kind: 'bool' },
          { key: 'badge', label: 'Badge text', kind: 'text', bilingual: true },
        ],
      },
    ],
    wells: [],
    blank: {
      eyebrow: { en: 'Pricing', sr: 'Cene' },
      title: { en: '', sr: '' },
      kicker: { en: '', sr: '' },
      plans: [],
    },
    render: (c) => `<section class="slide" aria-label="Pricing">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="split">
      <div>
        ${dual('h2', c.title, '', 'title')}
        ${kicker(c.kicker)}
      </div>
      <div>
        <div class="plans">
          ${(c.plans || [])
            .map(
              (p: any, i: number) => `<div class="plan${p?.popular ? ' hi' : ''}"${ed(`plans.${i}`)}>
            ${p?.popular ? `<span class="pop">${dualSpan(p?.badge)}</span>` : ''}
            <div class="name">${esc(p?.name)}</div>
            <div class="price">${esc(p?.price)} <small>${dualSpan(p?.per)}</small></div>
            ${dual('p', p?.aud, 'aud')}
            ${dual('p', p?.line)}
          </div>`
            )
            .join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
  {
    id: 'cta',
    name: 'Closing CTA (trial + store badges)',
    fields: [
      { key: 'eyebrow', label: 'Header', kind: 'text', bilingual: true },
      { key: 'title_pre', label: 'Title (before highlight)', kind: 'text', bilingual: true },
      { key: 'title_em', label: 'Title highlight (yellow)', kind: 'text', bilingual: true },
      { key: 'lede', label: 'Lede', kind: 'area', bilingual: true },
      { key: 'btn_label', label: 'Button label', kind: 'text', bilingual: true },
      { key: 'btn_url', label: 'Button URL', kind: 'text' },
      { key: 'dlnote', label: 'Download note', kind: 'area', bilingual: true },
    ],
    wells: [],
    blank: {
      eyebrow: { en: 'Get Started', sr: 'Počnite' },
      title_pre: { en: '', sr: '' },
      title_em: { en: '', sr: '' },
      lede: { en: '', sr: '' },
      btn_label: { en: 'Start your free trial', sr: 'Započnite besplatnu probu' },
      btn_url: 'https://balkina.ai/join',
      dlnote: { en: '', sr: '' },
    },
    render: (c) => `<section class="slide" aria-label="Get started">
  <div class="inner">
    ${eyebrow(c.eyebrow)}
    <div class="split stretch">
      <div>
        <h2 class="en"${ed('title_pre')}>${esc(bi(c.title_pre).en)} <em class="gd"${ed('title_em')}>${esc(bi(c.title_em).en)}</em></h2>
        <h2 class="sr"${ed('title_pre')}>${esc(bi(c.title_pre).sr)} <em class="gd"${ed('title_em')}>${esc(bi(c.title_em).sr)}</em></h2>
        ${dual('p', c.lede, 'lede', 'lede')}
      </div>
      <div>
        <div class="cta-col">
          <a class="btn gold" href="${esc(c.btn_url)}" target="_blank" rel="noopener"${ed('btn_label')}>${dualSpan(c.btn_label)}</a>
          ${dual('p', c.dlnote, 'dl-note', 'dlnote')}
          <div class="store-row">
            <a class="store" href="https://apps.apple.com/us/app/balkina-ai/id6761651423" target="_blank" rel="noopener">${APPLE_SVG}App Store</a>
            <a class="store" href="https://play.google.com/store/apps/details?id=com.tseggaid.balkinaai" target="_blank" rel="noopener">${GPLAY_SVG}Google Play</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
  },
];
