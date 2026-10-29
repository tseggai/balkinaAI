// Renders greyscale wireframes of the Prospects feature screens to PNG.
// Deliberately unstyled (no brand colours, no fonts): layout and content only.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #222; font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.35; }
  .page { padding: 24px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .between { justify-content: space-between; }
  .wrap { flex-wrap: wrap; }
  .box { border: 1px solid #999; border-radius: 6px; background: #fff; }
  .soft { border: 1px dashed #aaa; border-radius: 6px; background: #fafafa; }
  .pad { padding: 10px 12px; }
  .muted { color: #777; }
  .small { font-size: 11px; }
  .tiny { font-size: 10px; }
  .b { font-weight: 700; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 16px; margin: 0; }
  h3 { font-size: 11px; margin: 0; letter-spacing: .08em; text-transform: uppercase; color: #777; }
  .btn { border: 1px solid #555; border-radius: 6px; padding: 6px 10px; background: #fff; font-size: 12px; white-space: nowrap; }
  .btn.primary { background: #333; color: #fff; border-color: #333; }
  .btn.link { border: 0; padding: 0; text-decoration: underline; color: #444; }
  .chip { border: 1px solid #999; border-radius: 999px; padding: 3px 9px; font-size: 11px; white-space: nowrap; background: #fff; }
  .chip.on { background: #333; color: #fff; border-color: #333; }
  .chip.sm { padding: 1px 6px; font-size: 10px; }
  .select { border: 1px solid #999; border-radius: 6px; padding: 5px 8px; font-size: 12px; background: #fff; white-space: nowrap; }
  .select::after { content: ' ▾'; color: #777; }
  .input { border: 1px solid #999; border-radius: 6px; padding: 7px 10px; font-size: 12px; background: #fff; color: #999; }
  .kpi { flex: 1; }
  .kpi .v { font-size: 22px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #777; padding: 8px 8px; border-bottom: 1px solid #ccc; background: #f6f6f6; }
  td { padding: 9px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  .badge { display: inline-block; border: 1px solid #555; border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 700; }
  .ann { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #222; color: #fff; font-size: 11px; font-weight: 700; align-items: center; justify-content: center; margin-right: 6px; flex-shrink: 0; }
  .legend { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #444; columns: 2; column-gap: 24px; }
  .legend div { break-inside: avoid; margin-bottom: 4px; }
  .img { background: repeating-linear-gradient(45deg, #eee, #eee 6px, #f8f8f8 6px, #f8f8f8 12px); border: 1px solid #bbb; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; }
  .progress { height: 6px; border: 1px solid #999; border-radius: 3px; background: #fff; overflow: hidden; }
  .progress i { display: block; height: 100%; width: 45%; background: #555; }
  .dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #333; flex-shrink: 0; margin-top: 4px; }
  .dot.fill { background: #333; }
  .dot.half { background: #999; border-color: #999; }
  .overlay { background: #ddd; padding: 24px; }
  .caption { font-size: 11px; color: #555; margin-top: 10px; }
`;

const doc = (title, body, width) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body style="width:${width}px">${body}</body></html>`;

const legend = (items) => `<div class="legend">${items.map(([n, t]) => `<div><span class="ann">${n}</span>${t}</div>`).join('')}</div>`;

// ─── 1. Prospects page (desktop) ───────────────────────────────────────────
const rowsHtml = [
  ['6', 'Satoshi Signals', '@satoshisignals · YouTube', ['Lightning ⚡', '3 offerings · 1 email', 'Page ready'], 'bitcoin', 'YouTube', '48.2k · 312 videos<br><span class="muted">active 3d ago</span>', 'satoshisignals.com<br>@satsig · npub1q…9x<br>hello@satoshisignals.com', 'Page ready', 'Message sent · 2d ago<br><span class="muted">1 sent · 2 views · 1m 40s</span><br><span class="chip sm">Due today</span>', 'Email follow-up · open'],
  ['5', 'The Orange Pill Hour', 'podcast', ['Lightning ⚡', '2 offerings · 1 email', 'Claimed'], 'bitcoin', 'Podcast', '— · 148 episodes<br><span class="muted">active 6d ago</span>', 'orangepillhour.fm<br>show@orangepillhour.fm', 'Claimed', 'Claimed page · 1d ago<br><span class="muted">2 sent · 4 views · 6m 10s</span>', 'open'],
  ['4', 'plebdev', 'nostr', ['Lightning ⚡', 'No website'], 'lightning', 'Nostr', '3.1k followers · 1.2k notes<br><span class="muted">active today</span>', 'npub1a…7f · plebdev@getalby.com', 'Enriched', '—', 'Nostr DM · build page · open'],
  ['3', 'DeFi Daily', '@defidaily · YouTube', ['uses Patreon', '1 email'], 'defi', 'YouTube', '120k · 980 videos<br><span class="muted">active 1d ago</span>', 'defidaily.io<br>@defidaily<br>press@defidaily.io', 'Enriched', '—', 'Email · build page · open'],
  ['1', 'Café Lightning Berlin', 'merchant', ['Lightning ⚡', 'Site unreachable'], 'btc_merchant', 'BTC Map', '—<br><span class="muted">Berlin, DE</span>', 'cafe-lightning.de', 'New', '—', 'enrich · build page · open'],
];
const prospectsPage = doc('Prospects', `
<div class="page">
  <div class="row between" style="margin-bottom:16px">
    <div><span class="ann">1</span><h1 style="display:inline">Prospects</h1><div class="muted" style="margin-top:4px">Creators we found, what we know about them, and where each one is in the funnel.</div></div>
    <span class="btn primary"><span class="ann" style="background:#fff;color:#222">2</span>+ Generate prospects</span>
  </div>
  <div class="row" style="margin-bottom:14px">
    <span class="ann">3</span>
    ${[['Prospects', '1,284', '212 high fit · 903 enriched'], ['Pages built', '310', ''], ['Contacted', '241', '78% of pages'], ['Viewed page', '96', '40% of contacted'], ['Tested tipping', '31', '32% of viewers'], ['Claimed', '12', '5% of contacted']].map(([l, v, s]) => `<div class="box pad kpi"><div class="small muted">${l}</div><div class="v">${v}</div><div class="tiny muted">${s || '&nbsp;'}</div></div>`).join('')}
  </div>
  <div class="row wrap" style="margin-bottom:10px">
    <span class="ann">4</span>
    ${[['All', '1284', true], ['⏰ Due today', '17'], ['New', '381'], ['Enriched', '592'], ['Page ready', '69'], ['Contacted', '145'], ['Viewed page', '51'], ['Engaged', '14'], ['Replied', '9'], ['Claimed', '12'], ['Lost', '11']].map(([l, n, on]) => `<span class="chip ${on ? 'on' : ''}">${l} <span class="muted">${n}</span></span>`).join('')}
  </div>
  <div class="row wrap" style="margin-bottom:10px">
    <span class="ann">5</span>
    <span class="select">All niches</span><span class="select">All platforms</span><span class="select">All languages</span><span class="select">Any quality</span><span class="select">Email: any</span><span class="select">Page: any</span><span class="select">Activity: any</span>
    <span class="input" style="width:190px">Search name / site / handle</span>
    <span class="small muted" style="margin-left:auto">1284 matching · sorted by <u>score</u></span>
  </div>
  <div class="row soft pad" style="margin-bottom:10px">
    <span class="ann">6</span><span class="b">3 selected</span>
    <span class="btn">Enrich</span><span class="btn">Build pages</span><span class="select">Set stage…</span><span class="btn">Delete</span><span class="btn link" style="margin-left:auto">clear</span>
  </div>
  <div class="box" style="overflow:hidden">
  <table>
    <thead><tr><th>☐</th><th>Score</th><th>Creator</th><th>Niche</th><th>Platform</th><th>Reach</th><th>Contact</th><th>Stage</th><th>Activity</th><th></th></tr></thead>
    <tbody>
    ${rowsHtml.map(([s, name, sub, chips, niche, platform, reach, contact, stage, act, actions], i) => `<tr>
      <td>☐</td>
      <td><span class="badge">${s}</span></td>
      <td>${i === 0 ? '<span class="ann">7</span>' : ''}<span class="b">${name}</span><div class="muted tiny">${sub}</div><div class="row wrap" style="margin-top:4px">${chips.map((c) => `<span class="chip sm">${c}</span>`).join('')}</div></td>
      <td>${niche}</td><td>${platform}</td><td>${reach}</td><td class="small">${contact}</td>
      <td><span class="select">${stage}</span></td>
      <td class="small">${i === 0 ? '<span class="ann">8</span>' : ''}${act}</td>
      <td class="small" style="white-space:nowrap">${i === 0 ? '<span class="ann">9</span>' : ''}${actions}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  </div>
  <div class="row between muted small" style="margin-top:10px"><span>Page 1 of 26</span><span class="row"><span class="btn">Prev</span><span class="btn">Next</span></span></div>
  ${legend([
    [1, 'Page title + one-line description. Empty state (no prospects) shows the same description and the Generate button centred.'],
    [2, 'Opens the Generate prospects modal (screen 02).'],
    [3, 'Funnel strip: six KPIs from the facets endpoint; sub-lines are percentages of the previous step.'],
    [4, 'Stage tabs with counts. "Due today" is the follow-up queue (next_follow_up_at ≤ end of today, unclaimed), not a stage. Stages with 0 rows are hidden unless selected.'],
    [5, 'Filters (niche, platform, language, min score, email, page built, activity) + free-text search + sort (score / last activity / follow-up due).'],
    [6, 'Bulk bar appears when rows are selected: Enrich, Build pages, Set stage, Delete.'],
    [7, 'Creator cell: display name, handle · platform, chips from enrichment and claim state.'],
    [8, 'Activity cell: last action and relative time, counters (sent · views · time on page), due chip.'],
    [9, 'Row actions: quick-send on the best channel (Email → X → Nostr), build page (when none), enrich (when not enriched), open (drawer, screen 03).'],
  ])}
</div>`, 1280);

// ─── 2. Generate modal: setup + progress ───────────────────────────────────
const generateModal = doc('Generate prospects', `
<div class="overlay">
  <div class="box" style="max-width:760px;margin:0 auto;padding:20px">
    <h2>Generate prospects</h2>
    <div class="muted" style="margin:4px 0 14px">Pick which creators to find and where. The prospector searches each platform, scores every creator, and (optionally) visits their sites for contacts and offerings.</div>
    <div style="margin-bottom:12px"><span class="ann">1</span><span class="b">1. Niches</span> <span class="muted small" style="float:right">3 selected</span>
      <div class="row wrap" style="margin-top:6px">${['Bitcoin', 'Lightning / Nostr builders', 'Bitcoin mining', 'Sound money / macro', 'Crypto (general)', 'DeFi / Ethereum', 'Privacy & open source', 'Accepts Bitcoin (merchants)'].map((n, i) => `<span class="chip ${i < 3 ? 'on' : ''}">${n}</span>`).join('')}</div>
      <div class="row small" style="margin-top:6px"><span class="btn link">Bitcoin only</span><span class="btn link">Bitcoin + crypto</span><span class="btn link">everything</span><span class="btn link muted">clear</span></div></div>
    <div style="margin-bottom:12px"><span class="ann">2</span><span class="b">2. Platforms</span> <span class="muted small" style="float:right">3 selected</span>
      <div class="row wrap" style="margin-top:6px"><span class="chip on">YouTube</span><span class="chip on">Podcasts</span><span class="chip on">Nostr</span><span class="chip">Bitcoin merchants (BTC Map)</span><span class="chip" style="opacity:.45" title="X_BEARER_TOKEN not set">X (not configured)</span><span class="chip">CSV import…</span></div></div>
    <div style="margin-bottom:12px"><span class="ann">3</span><span class="b">3. Languages</span> <span class="muted small">and optional regions</span>
      <div class="row wrap" style="margin-top:6px"><span class="chip on">EN</span><span class="chip">ES</span><span class="chip">DE</span><span class="chip">PT</span> <span class="muted small" style="margin-left:12px">Regions:</span><span class="chip">US</span><span class="chip">DE</span><span class="input" style="width:120px">Add region</span></div></div>
    <div style="margin-bottom:12px"><span class="ann">4</span><span class="b">4. Depth</span>
      <div class="row" style="margin-top:6px"><span class="select">Top 100 per search</span><label class="row small">☑ Enrich automatically (visit sites for emails, links, offerings)</label></div></div>
    <div class="soft pad small" style="margin-bottom:12px"><span class="ann">5</span><span class="b">9</span> searches (3 niches × 3 platforms × 1 language) · up to <span class="b">~700</span> creators · YouTube quota ≈ 600 of 10,000 units/day · podcasts and Nostr are free · enrichment ≈ 700 page fetches</div>
    <div class="row" style="justify-content:flex-end"><span class="btn">Cancel</span><span class="btn primary">Generate prospects</span></div>
  </div>
  <div class="box" style="max-width:760px;margin:16px auto 0;padding:20px">
    <h2>Generate prospects <span class="muted small">(running)</span></h2>
    <div style="margin-top:10px"><span class="ann">6</span>
      <div class="row" style="padding:5px 0">✓ <span>Preparing searches</span></div>
      <div class="row" style="padding:5px 0">… <span>Searching YouTube · Podcasts · Nostr (4/9)</span><span class="muted small">312 found · 190 new · 41 merged · 38 requests</span></div>
      <div class="row muted" style="padding:5px 0">· <span>Enriching sites</span></div>
      <div class="progress" style="margin-top:8px"><i></i></div>
    </div>
    <div class="soft pad small" style="margin-top:10px">Done. 190 new prospects added, 150 enriched, 61 emails found. Next: review them in the list, then build their pages and start outreach.</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><span class="btn primary">Close</span></div>
  </div>
  ${legend([
    [1, 'Niche chips from GROWTH_NICHES with preset shortcuts.'],
    [2, 'Platform chips from GROWTH_PLATFORMS; a platform whose env var is missing is disabled with a tooltip; CSV opens the import panel.'],
    [3, 'Language chips (default EN) and optional region codes (YouTube regionCode, BTC Map country).'],
    [4, 'Depth = pages per search (1–3) and the auto-enrich checkbox.'],
    [5, 'Cost preview computed client-side before running; the button is disabled above 60 searches.'],
    [6, 'Run phases: preparing (POST generate) → searching (POST prospector in chunks of 2 targets) → enriching (POST enricher in rounds of 16 until processed = 0) → done/error. A fatal provider error stops that platform and is shown inline.'],
  ])}
</div>`, 820);

// ─── 3. Drawer: Overview ───────────────────────────────────────────────────
const drawerHeader = `
  <div class="box pad" style="border-radius:0;border-width:0 0 1px 0">
    <div class="row between">
      <div><span class="ann">1</span><span class="b" style="font-size:16px">Satoshi Signals</span> <span class="btn" style="padding:2px 6px;font-size:11px">Re-enrich</span>
        <div class="muted small" style="margin-top:4px">YouTube · 48.2k subscribers · bitcoin · <u>profile</u> <span class="badge">score 6</span> <span class="chip sm">Due today</span></div></div>
      <div class="row"><span class="btn">‹</span><span class="btn">›</span><span class="btn">✕</span></div>
    </div>
    <div class="row wrap small" style="margin-top:8px"><span class="ann">2</span>✉ hello@satoshisignals.com · 𝕏 @satsig · ⚡︎ npub1q…9x ⎘ · ▶ youtube.com/@satoshisignals · ✈ t.me/satsig · 🌐 satoshisignals.com · <span class="btn link">Edit</span></div>
    <div class="row wrap small" style="margin-top:6px"><span class="ann">3</span><span style="font-family:monospace">brand.example/c/3f9a1c2b7e4d?c=em</span> <span class="btn link">copy</span> <span class="muted">valid until 28 Nov</span></div>
    <div class="row" style="margin-top:10px;gap:18px"><span class="b" style="border-bottom:2px solid #222;padding-bottom:4px">Overview</span><span class="muted">Activity <span class="chip sm">7</span></span></div>
  </div>`;
const drawerOverview = doc('Prospect drawer — Overview', `
<div style="display:flex">
  <div style="flex:1;background:#ddd"></div>
  <div style="width:680px;background:#f3f3f3;min-height:900px">
    ${drawerHeader}
    <div style="padding:14px">
      <div class="row" style="margin-bottom:10px"><span class="ann">4</span>${[['Sent', '1'], ['Page views', '2'], ['Time on page', '1m 40s'], ['Tested tipping', '—']].map(([l, v]) => `<div class="box pad kpi"><div class="tiny muted">${l}</div><div class="b" style="font-size:18px">${v}</div></div>`).join('')}</div>
      <div class="box pad" style="margin-bottom:10px"><h3>Notes</h3><div class="input" style="margin-top:6px;height:40px">Anything worth remembering about this creator…</div></div>
      <div class="box pad" style="margin-bottom:10px"><span class="ann">5</span><h3 style="display:inline">Messages</h3><span class="muted small" style="float:right">1 sent · last 2d ago</span>
        <div class="row wrap" style="margin-top:8px"><span class="select">Follow-up</span>
          <span class="row" style="gap:0"><span class="chip on" style="border-radius:6px 0 0 6px">✉</span><span class="chip" style="border-radius:0">𝕏</span><span class="chip" style="border-radius:0">⚡︎</span><span class="chip" style="border-radius:0">▶</span><span class="chip" style="border-radius:0">✈</span><span class="chip" style="border-radius:0 6px 6px 0">⎘</span></span>
          <span class="select" style="margin-left:auto">Page ready</span></div>
        <div class="input" style="margin-top:8px;height:86px;color:#333">Subject: Satoshi Signals — your page is ready<br>Hi Alex, did you get a chance to look at the page we built for Satoshi Signals? Trying it takes 20 seconds, and claiming is free.<br>brand.example/c/3f9a1c2b7e4d?c=em</div>
        <div class="row small" style="margin-top:8px"><span class="btn primary">✉ Copy & open email</span><span class="btn link">Reset text</span><span class="muted">Logs it and sets the follow-up 3 days out.</span></div></div>
      <div class="row" style="gap:10px;margin-bottom:10px;align-items:stretch">
        <div class="box pad" style="flex:1"><span class="ann">6</span><h3 style="display:inline">Follow-up</h3> <span class="chip sm">Due today</span><div class="row wrap" style="margin-top:8px"><span class="select">29 Oct 2026</span><span class="btn">Tomorrow</span><span class="btn">+3 days</span><span class="btn">+1 week</span></div></div>
        <div class="box pad" style="flex:1"><h3>They got back to us</h3><div class="row wrap small" style="margin-top:8px"><span class="muted">Replied via</span><span class="row" style="gap:0"><span class="chip" style="border-radius:6px 0 0 6px">✉</span><span class="chip" style="border-radius:0">𝕏</span><span class="chip" style="border-radius:0">⚡︎</span><span class="chip" style="border-radius:0 6px 6px 0">✈</span></span><span class="btn">Log a call</span></div><div class="tiny muted" style="margin-top:6px">A reply moves the stage to Replied and puts them back in today's queue.</div></div>
      </div>
      <div class="box pad"><span class="ann">7</span><h3 style="display:inline">What we know</h3> <span class="muted tiny">fetched 27 Oct · <u>site</u></span> <span class="chip sm">Lightning verified ✓</span>
        <div class="small" style="margin-top:6px">Weekly Bitcoin news and self-custody tutorials for beginners, hosted by Alex R.</div>
        <div class="small" style="margin-top:6px;columns:2;column-gap:16px"><div><span class="muted">Person:</span> Alex R.</div><div><span class="muted">Topics:</span> self-custody, nodes, mining, macro</div><div><span class="muted">Offerings:</span> Monthly supporter 10 USD · Node setup consult 150 USD · Course "Run your own node"</div><div><span class="muted">Monetization:</span> buymeacoffee, getalby</div><div><span class="muted">Competitor:</span> —</div><div><span class="muted">Languages:</span> en</div><div><span class="muted">Recent:</span> "Why your seed phrase…", "Node vs wallet", "Fee market 101"</div></div></div>
    </div>
  </div>
</div>
${legend([
  [1, 'Header: name, Enrich/Re-enrich, platform · reach · niche · profile link, score, due/claimed chips; prev/next (arrow keys) and close (Esc).'],
  [2, 'Contact row: one icon-link per channel we have (email, X, Nostr npub with copy, YouTube, Telegram, website) and Edit (opens the edit form: email, X, npub, Telegram, Lightning address, website, Delete).'],
  [3, 'Page row: short claim link + copy + validity, or the "Build page" button when none exists.'],
  [4, 'Four stats from the CRM counters.'],
  [5, 'Messages composer: step · channel · stage; textarea pre-filled from the template for that step/channel; one action button per channel; every send logs a `sent` event and schedules the follow-up.'],
  [6, 'Follow-up date (picker + quick buttons) and inbound logging (replied via channel, log a call).'],
  [7, 'Enrichment facts card, shown once enriched.'],
])}`, 1280);

// ─── 4. Drawer: Activity ───────────────────────────────────────────────────
const drawerActivity = doc('Prospect drawer — Activity', `
<div style="display:flex">
  <div style="flex:1;background:#ddd"></div>
  <div style="width:680px;background:#f3f3f3;min-height:760px">
    ${drawerHeader.replace('<span class="b" style="border-bottom:2px solid #222;padding-bottom:4px">Overview</span><span class="muted">Activity <span class="chip sm">7</span></span>', '<span class="muted">Overview</span><span class="b" style="border-bottom:2px solid #222;padding-bottom:4px">Activity <span class="chip sm">7</span></span>')}
    <div style="padding:14px">
      <div class="box pad">
        <div class="row between"><span class="row" style="gap:0"><span class="ann">1</span><span class="chip on" style="border-radius:6px 0 0 6px">All</span><span class="chip" style="border-radius:0">Their actions</span><span class="chip" style="border-radius:0 6px 6px 0">Ours</span></span><span class="muted tiny">2 views · 1m 40s on page · 1 sent</span></div>
        <div class="row" style="margin-top:10px"><span class="input" style="flex:1">Add a note…</span><span class="btn primary">Add</span></div>
        <div style="margin-top:12px"><span class="ann">2</span>
        ${[
          ['fill', 'Pressed activate', '1h ago', 'web · EN', ''],
          ['fill', 'Opened activation', '1h ago', 'web', ''],
          ['fill', 'Tested tipping', '1h ago', 'web · EN', ''],
          ['fill', 'Time on page', '1h ago', '', '1m 40s'],
          ['fill', 'Viewed page', '1h ago', 'web · via email', ''],
          ['half', 'Message sent', '2d ago', 'email · first touch · EN', 'Hi Alex, we set up a page for Satoshi Signals so your audience can send you sats in one tap…'],
          ['half', 'Note', '3d ago', '', 'Mentioned on the Orange Pill Hour, ep. 140.'],
          ['half', 'page_built', '3d ago', '', ''],
        ].map(([d, t, when, meta, detail]) => `<div class="row" style="align-items:flex-start;padding:6px 0;border-bottom:1px solid #e5e5e5"><span class="dot ${d}"></span><div style="flex:1"><div class="row between"><span class="${d === 'fill' ? 'b' : ''}">${t}</span><span class="muted tiny">${when}</span></div>${meta ? `<div class="muted tiny">${meta}</div>` : ''}${detail ? `<div class="small" style="margin-top:2px">${detail}</div>` : ''}</div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</div>
${legend([
  [1, 'Filter: all / their actions (claim_* and replied) / ours (sent, note, call, page_built).'],
  [2, 'Timeline newest first (max 200). Filled dot = the prospect acted; hollow/half = we acted. Labels come from a type → label map; `sent` shows the message text (clamped), `claim_page_leave` shows the seconds.'],
])}`, 1280);

// ─── 5. Mobile cards ───────────────────────────────────────────────────────
const mobileList = doc('Prospects — mobile', `
<div style="padding:14px">
  <div class="row between" style="margin-bottom:10px"><h1>Prospects</h1><span class="btn primary">+ Generate</span></div>
  <div class="row" style="gap:6px;overflow:hidden;margin-bottom:8px">${['Prospects 1,284', 'Pages 310', 'Contacted 241', 'Viewed 96'].map((k) => `<div class="box pad small" style="flex:1;white-space:nowrap">${k}</div>`).join('')}</div>
  <div class="row" style="gap:6px;overflow:hidden;margin-bottom:8px"><span class="chip on">All 1284</span><span class="chip">⏰ Due 17</span><span class="chip">New 381</span><span class="chip">Enriched 592</span><span class="chip">Page r…</span></div>
  <div class="row wrap" style="gap:6px;margin-bottom:8px"><span class="select">All niches</span><span class="select">All platforms</span><span class="select">Any quality</span><span class="input" style="width:100%">Search</span></div>
  <label class="small muted">☐ Select all on this page</label>
  ${rowsHtml.slice(0, 3).map(([s, name, sub, chips, niche, platform, reach, contact, stage, act, actions]) => `
  <div class="box pad" style="margin-top:8px">
    <div class="row" style="align-items:flex-start"><span>☐</span><div style="flex:1">
      <div class="row between"><span class="b">${name}</span><span class="badge">${s}</span></div>
      <div class="muted tiny">${niche} · ${platform} · ${reach.replace('<br>', ' · ')}</div>
      <div class="row wrap" style="margin-top:4px;gap:4px">${chips.map((c) => `<span class="chip sm">${c}</span>`).join('')}</div>
      <div class="small" style="margin-top:6px">${contact}</div>
      <div class="small" style="margin-top:6px">${act}</div>
      <div class="row between" style="margin-top:8px"><span class="select">${stage}</span><span class="small">${actions}</span></div>
    </div></div>
  </div>`).join('')}
  ${legend([[1, 'Phone width: the same data and actions as the table, one card per prospect; KPI strip and stage tabs scroll horizontally; the drawer becomes full-screen.']])}
</div>`, 390);

// ─── 6. Claim page (mobile) ────────────────────────────────────────────────
const claimPage = doc('Claim page', `
<div style="padding:16px 18px">
  <div class="row between" style="margin-bottom:14px"><span class="img" style="width:90px;height:22px"></span><span class="row"><span class="btn" style="border-radius:50%;width:32px;height:32px;padding:0;text-align:center;line-height:30px">?</span><span class="row" style="gap:0"><span class="chip on" style="border-radius:999px 0 0 999px">EN</span><span class="chip" style="border-radius:0 999px 999px 0">ES</span></span></span></div>
  <div class="box" style="padding:10px;margin-bottom:12px"><span class="ann">1</span><span class="muted tiny">PREVIEW · nothing is live yet</span>
    <div class="soft" style="padding:14px;margin-top:8px">
      <div class="row"><span class="img avatar" style="width:56px;height:56px"></span><div><div class="b" style="font-size:18px">Satoshi Signals</div><div class="muted small">@satoshisignals</div></div></div>
      <div class="small" style="margin-top:8px">Weekly Bitcoin news and self-custody tutorials for beginners.</div>
      <div class="row wrap" style="margin-top:8px"><span class="chip sm">▶ YouTube</span><span class="chip sm">𝕏 @satsig</span><span class="chip sm">⚡︎ Nostr</span><span class="chip sm">🌐 Site</span></div>
      <div class="box pad" style="margin-top:10px"><div class="row between"><span class="b">Monthly supporter</span><span class="muted">10 USD</span></div></div>
      <div class="box pad" style="margin-top:6px"><div class="row between"><span class="b">Node setup consult</span><span class="muted">150 USD</span></div></div>
      <div class="btn primary" style="margin-top:10px;text-align:center;opacity:.5">⚡ Send sats (disabled in preview)</div>
      <div class="muted tiny" style="margin-top:6px;text-align:center">← the product's real creator page component, rendered with the unclaimed row</div>
    </div>
  </div>
  <div style="margin-bottom:14px"><span class="ann">2</span>Alex,<br>we set up <span class="b">Satoshi Signals</span> on {BRAND} so your audience can send you sats in one tap. Test it, like it, and claim it for free.</div>
  <div class="soft" style="padding:8px"><span class="ann">3</span>
    <div class="btn primary row between" style="padding:12px 14px"><span><div class="tiny" style="opacity:.8;letter-spacing:.08em">TRY IT AS A FAN</div><div style="font-size:17px">Send sats</div></span><span>›</span></div>
    <div class="row" style="margin:8px 0;gap:8px"><span style="flex:1;height:1px;background:#bbb"></span><span class="tiny muted">AND</span><span style="flex:1;height:1px;background:#bbb"></span></div>
    <div class="btn primary row between" style="padding:12px 14px"><span><div class="tiny" style="opacity:.8;letter-spacing:.08em">CLAIM YOUR PAGE — FREE</div><div style="font-size:17px">Activate now</div></span><span>›</span></div>
  </div>
  <div class="small muted" style="text-align:center;margin-top:12px"><span class="ann">4</span>Offer expires on 28 November.</div>
  ${legend([
    [1, 'The real creator page component in a preview wrapper (banner, money actions disabled). Hotlinked platform avatar; offerings from enrichment or niche defaults.'],
    [2, 'What we did: first name on its own line, one sentence with the product\'s value, one sentence of ask.'],
    [3, 'Two CTAs: open the demo sheet (screen 07) / open the activate sheet (screen 08). Both log an event.'],
    [4, 'Claim expiry from claim_expires_at. Language toggle only when the product has more than one language. The "?" button is the optional support contact.'],
  ])}
</div>`, 390);

// ─── 7. Demo sheet ─────────────────────────────────────────────────────────
const sheet = (eyebrow, inner) => `<div class="box" style="border-radius:16px 16px 0 0;padding:14px 16px 18px;background:#fff"><div class="row between"><span class="tiny b" style="letter-spacing:.08em">${eyebrow}</span><span>✕</span></div>${inner}</div>`;
const demoSheet = doc('Demo sheet', `
<div style="background:#bbb;padding:40px 0 0">
  ${sheet('DEMO · NOTHING IS SENT', `
    <div class="row" style="margin-top:10px;gap:4px"><span style="flex:1;height:4px;background:#333"></span><span style="flex:1;height:4px;background:#333"></span><span style="flex:1;height:4px;background:#ddd"></span><span class="tiny muted">Step 2 of 3</span></div>
    <div class="b" style="font-size:16px;margin-top:12px"><span class="ann">1</span>Pay 5,000 sats to Satoshi Signals</div>
    <div class="img" style="width:180px;height:180px;margin:12px auto;position:relative"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;color:#777;transform:rotate(-20deg)">DEMO</div></div>
    <div class="muted small" style="text-align:center">A fake invoice. In the real flow the fan scans this with any Lightning wallet.</div>
    <div class="row" style="margin-top:12px"><span class="btn">Back</span><span class="btn primary" style="flex:1;text-align:center">Simulate payment</span></div>
  `)}
</div>
<div style="background:#bbb;padding:24px 0 0;margin-top:24px">
  ${sheet('DEMO · NOTHING IS SENT', `
    <div style="margin-top:10px"><span class="ann">2</span><h3 style="display:inline">What the fan sees</h3>
      <div class="soft pad" style="margin-top:6px"><div class="b">✓ Sent 5,000 sats to Satoshi Signals</div><div class="small muted" style="margin-top:4px">"Love the show" · instant · no fees held back</div></div></div>
    <div style="margin-top:12px"><span class="ann">3</span><h3 style="display:inline">What you see</h3>
      <div class="box pad" style="margin-top:6px;background:#333;color:#fff"><div class="row between"><span class="b small">⚡ New tip · 5,000 sats</span><span class="tiny" style="opacity:.7">now</span></div><div class="small" style="opacity:.85">"Love the show" — from a fan</div></div>
      <div class="box pad" style="margin-top:6px"><div class="row between"><span class="b">Today</span><span class="muted">5,000 sats</span></div><div class="row between small muted" style="margin-top:4px"><span>This month</span><span>184,000 sats</span></div><div class="row" style="margin-top:8px"><span class="btn" style="flex:1;text-align:center">Thank</span><span class="btn" style="flex:1;text-align:center">Withdraw</span></div></div></div>
    <div class="soft pad" style="margin-top:12px"><span class="ann">4</span><div class="tiny b" style="letter-spacing:.08em">THIS IS A DEMO · NOTHING WAS SENT</div><div class="small" style="margin-top:4px">Claim your page to make it live in under a minute.</div><div class="btn primary" style="margin-top:8px;text-align:center">Claim my page</div><div class="small" style="text-align:center;margin-top:6px"><u>Try again</u></div></div>
  `)}
</div>
${legend([
  [1, 'Demo = the product\'s primary fan action simulated in 3–4 steps (default: pick amount → fake invoice → confirmation). Nothing is written to the DB; a watermark says so.'],
  [2, 'Confirmation, fan side.'],
  [3, 'Confirmation, creator side: a notification mock and the dashboard card, both in the product\'s own look.'],
  [4, 'Disclaimer + Claim my page (opens the activate sheet) + Try again. Completing the demo logs claim_demo_completed → stage engaged.'],
])}`, 390);

// ─── 8. Activate + share ───────────────────────────────────────────────────
const activateSheet = doc('Activate and share', `
<div style="background:#bbb;padding:40px 0 0">
  ${sheet('SATOSHI SIGNALS', `
    <div class="b" style="font-size:17px;margin-top:10px"><span class="ann">1</span>Activate in 10 seconds</div>
    <div class="muted small">No card. No password.</div>
    <div class="soft pad" style="margin-top:12px">Signing you in as <span class="b">hello@satoshisignals.com</span> <u class="small">(change)</u></div>
    <div class="btn primary" style="margin-top:10px;text-align:center;padding:12px">Activate my page</div>
    <div class="small muted" style="margin-top:10px">+ Set name and password now</div>
    <div class="tiny muted" style="text-align:center;margin-top:12px">By claiming you agree to our Terms and Privacy Policy.</div>
  `)}
</div>
<div style="background:#bbb;padding:24px 0 0;margin-top:24px">
  ${sheet('SATOSHI SIGNALS', `
    <div class="b" style="font-size:17px;margin-top:10px"><span class="ann">2</span>✓ Your page is live</div>
    <div class="muted small">Share your link — the first sats can arrive today.</div>
    <div class="soft pad" style="margin-top:12px"><div class="tiny b" style="letter-spacing:.08em">YOUR LINK</div><div style="margin-top:2px">brand.example/satoshisignals</div></div>
    <div class="row" style="margin-top:8px"><span class="btn" style="flex:1;text-align:center;padding:10px">View</span><span class="btn primary" style="flex:1;text-align:center;padding:10px">Share</span></div>
    <div class="box" style="margin-top:6px"><div class="pad small">⎘ Copy link</div><div class="pad small" style="border-top:1px solid #e5e5e5">𝕏 Post on X</div><div class="pad small" style="border-top:1px solid #e5e5e5">⚡︎ Copy a Nostr note</div></div>
    <div class="small muted" style="margin-top:8px">Put this link in your YouTube description, X bio and Nostr profile.</div>
    <div class="btn primary" style="margin-top:12px;text-align:center;padding:12px"><span class="ann" style="background:#fff;color:#222">3</span>Open my dashboard</div>
    <div class="tiny muted" style="margin-top:6px">A sign-in link is on its way to your inbox.</div>
  `)}
</div>
${legend([
  [1, 'Activate sheet: email is the only required input (pre-filled from the prospect; "change" reveals the field); optional name + password behind a disclosure. POST /api/claim.'],
  [2, 'Share screen after success: page URL, View, Share (native share sheet on phones; copy / X intent / Nostr note text on desktop).'],
  [3, 'Open my dashboard mints a fresh single-use sign-in link (POST /api/claim/login) and redirects to the dashboard auth callback.'],
])}`, 390);

const screens = [
  ['01-prospects-page', prospectsPage, 1280],
  ['02-generate-modal', generateModal, 820],
  ['03-drawer-overview', drawerOverview, 1280],
  ['04-drawer-activity', drawerActivity, 1280],
  ['05-mobile-cards', mobileList, 390],
  ['06-claim-page', claimPage, 390],
  ['07-claim-demo', demoSheet, 390],
  ['08-claim-activate-share', activateSheet, 390],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, html, width] of screens) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    await page.close();
    console.log('wrote', name);
  }
  await browser.close();
})();
