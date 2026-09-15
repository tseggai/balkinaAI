/* eslint-disable @typescript-eslint/no-explicit-any */
// Deck assembly: templates registry + full-page HTML builder used by the
// public /deck and /tenant-deck routes (and the admin preview).
import type { DeckId, SlideRow, TemplateDef } from './types';
import { TENANT_TEMPLATES } from './tenant';
import { WHITELABEL_TEMPLATES } from './whitelabel';
import { TENANT_CSS } from './tenant-css';
import { WHITELABEL_CSS } from './whitelabel-css';
import { LOGO_WHITE } from './html';

export * from './types';
export { esc } from './html';

export const DECK_TEMPLATES: Record<DeckId, TemplateDef[]> = {
  tenant: TENANT_TEMPLATES,
  whitelabel: WHITELABEL_TEMPLATES,
};

export const DECK_CSS: Record<DeckId, string> = {
  tenant: TENANT_CSS,
  whitelabel: WHITELABEL_CSS,
};

export function getTemplate(deck: DeckId, id: string): TemplateDef | undefined {
  return DECK_TEMPLATES[deck]?.find((t) => t.id === id);
}

export function renderSlide(deck: DeckId, slide: Pick<SlideRow, 'template' | 'content'>): string {
  const tpl = getTemplate(deck, slide.template);
  if (!tpl) return `<section class="slide"><div class="inner"><p>Unknown template: ${slide.template}</p></div></section>`;
  try {
    return tpl.render(slide.content || {});
  } catch {
    return `<section class="slide"><div class="inner"><p>Slide failed to render.</p></div></section>`;
  }
}

const NAV_JS = `
  const slides=[...document.querySelectorAll(".slide")];
  const counter=document.getElementById("counter");
  const progress=document.getElementById("progress");
  const pad=n=>String(n).padStart(2,"0");
  let i=Math.min(Math.max((parseInt(location.hash.slice(1),10)||1)-1,0),slides.length-1);
  function show(n){
    i=Math.min(Math.max(n,0),slides.length-1);
    slides.forEach((s,k)=>s.classList.toggle("active",k===i));
    counter.innerHTML="<b>"+pad(i+1)+"</b> / "+pad(slides.length);
    progress.style.width=((i+1)/slides.length*100)+"%";
    history.replaceState(null,"","#"+(i+1));
  }
  document.getElementById("next").addEventListener("click",()=>show(i+1));
  document.getElementById("prev").addEventListener("click",()=>show(i-1));
  addEventListener("keydown",e=>{
    if(["ArrowRight","PageDown"," "].includes(e.key)){e.preventDefault();show(i+1);}
    else if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();show(i-1);}
    else if(e.key==="Home")show(0);
    else if(e.key==="End")show(slides.length-1);
  });
  let x0=null,y0=null;
  addEventListener("touchstart",e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  addEventListener("touchend",e=>{
    if(x0===null)return;
    const dx=e.changedTouches[0].clientX-x0;
    const dy=e.changedTouches[0].clientY-y0;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)show(i+(dx<0?1:-1));
    x0=y0=null;
  },{passive:true});
  show(i);
`;

function langJs(def: 'en' | 'sr', storageKey: string): string {
  return `
  const root=document.documentElement;
  function setLang(l){
    root.setAttribute("data-lang",l);
    document.getElementById("lang-sr").classList.toggle("on",l==="sr");
    document.getElementById("lang-en").classList.toggle("on",l==="en");
    try{localStorage.setItem("${storageKey}",l);}catch(e){}
  }
  document.getElementById("lang-sr").addEventListener("click",()=>setLang("sr"));
  document.getElementById("lang-en").addEventListener("click",()=>setLang("en"));
  let saved="${def}";
  try{saved=localStorage.getItem("${storageKey}")||"${def}";}catch(e){}
  setLang(saved==="en"?"en":"sr");
`;
}

function langSwitch(def: 'en' | 'sr'): string {
  return `<div class="langswitch" role="group" aria-label="Language">
  <button id="lang-en" class="${def === 'en' ? 'on' : ''}" type="button">EN</button>
  <button id="lang-sr" class="${def === 'sr' ? 'on' : ''}" type="button">CG</button>
</div>`;
}

export function buildDeckHtml(deck: DeckId, slides: SlideRow[]): string {
  const sections = slides
    .map((s, i) => {
      const html = renderSlide(deck, s);
      return i === 0 ? html.replace('class="slide', 'class="slide active') : html;
    })
    .join('\n\n');

  if (deck === 'tenant') {
    return `<!doctype html>
<html lang="sr" data-lang="sr">
<head>
<meta name="robots" content="noindex">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balkina AI — Za vaš biznis</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap" rel="stylesheet">
</head>
<body>
<style>${TENANT_CSS}</style>

<div class="progress" id="progress"></div>

<div class="brandbar"><img src="${LOGO_WHITE}" alt="Balkina AI"></div>

${langSwitch('sr')}

${sections}

<div class="chrome">
  <div class="wordmark"><img src="${LOGO_WHITE}" alt=""><b>Balkina AI</b> · <span class="en">For Your Business</span><span class="sr">Za vaš biznis</span></div>
  <div class="nav">
    <span class="counter" id="counter"><b>01</b> / ${String(slides.length).padStart(2, '0')}</span>
    <button class="arrow" id="prev" aria-label="Previous slide">←</button>
    <button class="arrow" id="next" aria-label="Next slide">→</button>
  </div>
</div>

<script>${langJs('sr', 'deck-lang')}${NAV_JS}</script>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="en" data-lang="en">
<head>
<meta name="robots" content="noindex">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balkina AI — White-Label for Property Owners</title>
</head>
<body>
<style>${WHITELABEL_CSS}</style>

<div class="progress" id="progress"></div>

${langSwitch('en')}

${sections}

<div class="chrome">
  <div class="wordmark"><b>Balkina AI</b> · White Label</div>
  <div class="nav">
    <span class="counter" id="counter"><b>01</b> / ${String(slides.length).padStart(2, '0')}</span>
    <button class="arrow" id="prev" aria-label="Previous slide">←</button>
    <button class="arrow" id="next" aria-label="Next slide">→</button>
  </div>
</div>

<script>${langJs('en', 'deck-lang-wl')}${NAV_JS}</script>
</body>
</html>`;
}
