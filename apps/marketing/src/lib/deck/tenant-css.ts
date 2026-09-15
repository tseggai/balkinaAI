// Tenant deck stylesheet — verbatim from the hand-built static deck.
export const TENANT_CSS = `
  :root{
    --ink:#6B7FC4;
    --panel:#5F72B8;
    --panel-2:#6577BC;
    --paper:#FFFFFF;
    --paper-dim:#EBEFFC;
    --slate:#DDE3F8;
    --navy:#232B5E;
    --sun:#FFE300;
    --sun-soft:rgba(255,227,0,.55);
    --hairline:rgba(255,255,255,.32);
    --font:"Quicksand","Avenir Next","Segoe UI",system-ui,Arial,sans-serif;
  }
  html,body{height:100%;}
  body{
    margin:0;background:var(--ink);color:var(--paper);
    font-family:var(--font);font-size:22px;font-weight:400;line-height:1.55;
    overflow:hidden;
    -webkit-font-smoothing:antialiased;
  }
  /* ---------- language switch + brand header ---------- */
  html[data-lang="sr"] .en{display:none !important;}
  html[data-lang="en"] .sr{display:none !important;}
  .brandbar{position:fixed;top:16px;left:34px;z-index:50;}
  .brandbar img{height:32px;width:auto;display:block;}
  .langswitch{
    position:fixed;top:18px;right:34px;z-index:50;display:flex;gap:6px;
    border:1px solid var(--hairline);border-radius:999px;padding:4px;
  }
  .langswitch button{
    background:none;border:0;border-radius:999px;cursor:pointer;
    font-family:var(--font);font-size:11px;letter-spacing:.1em;font-weight:700;
    color:var(--slate);padding:7px 14px;text-transform:uppercase;
  }
  .langswitch button.on{background:var(--sun);color:var(--navy);}
  .langswitch button:focus-visible{outline:2px solid var(--sun);outline-offset:2px;}
  /* ---------- deck chrome ---------- */
  .progress{position:fixed;top:0;left:0;height:2px;background:var(--sun);width:0%;z-index:40;transition:width .5s ease;}
  .chrome{
    position:fixed;left:0;right:0;bottom:0;z-index:40;
    display:flex;align-items:center;justify-content:space-between;
    padding:18px 34px;pointer-events:none;
  }
  .wordmark{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);display:flex;align-items:center;gap:10px;}
  .wordmark b{color:var(--paper);font-weight:700;}
  .wordmark img{height:18px;width:auto;opacity:.95;}
  .nav{display:flex;align-items:center;gap:18px;pointer-events:auto;}
  .counter{font-size:11px;letter-spacing:.12em;color:var(--slate);font-variant-numeric:tabular-nums;}
  .counter b{color:var(--paper);font-weight:700;}
  .arrow{
    background:none;border:1px solid var(--hairline);color:var(--paper-dim);
    width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;
    transition:border-color .25s,color .25s;
  }
  .arrow:hover{border-color:var(--sun);color:var(--sun);}
  .arrow:focus-visible{outline:2px solid var(--sun);outline-offset:3px;}
  /* ---------- slides ---------- */
  .slide{
    position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;
    padding:104px 7vw 92px;box-sizing:border-box;
    opacity:0;visibility:hidden;transform:translateY(14px);
    transition:opacity .6s ease,transform .6s ease,visibility 0s linear .6s;
  }
  .slide.active{opacity:1;visibility:visible;transform:none;transition:opacity .6s ease,transform .6s ease;}
  .inner{width:min(1160px,100%);}
  /* eyebrow header above both columns */
  .eyebrow{
    font-size:clamp(22px,2.8vw,40px);letter-spacing:.08em;text-transform:uppercase;color:var(--sun);
    margin:0 0 34px;font-weight:400;line-height:1.15;
  }
  .eyebrow::after{content:"";display:block;width:52px;height:1px;background:var(--sun-soft);margin-top:14px;}
  .split{display:grid;grid-template-columns:.95fr 1.05fr;gap:64px;align-items:start;}
  .split.stretch{align-items:stretch;}
  h1,h2{font-weight:300;letter-spacing:0;text-wrap:balance;margin:0;font-size:clamp(38px,5.2vw,85px);line-height:1.08;}
  .lede{font-size:clamp(19px,1.9vw,30px);font-weight:400;color:var(--paper);max-width:34em;margin:24px 0 0;}
  .kicker{
    margin-top:34px;padding-top:20px;border-top:1px solid var(--hairline);
    font-weight:300;font-size:clamp(24px,2.4vw,34px);color:var(--sun);
    text-wrap:balance;line-height:1.3;
  }
  em.gd{font-style:normal;color:var(--sun);}
  /* points */
  .points{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:36px;}
  .points li{padding-left:32px;position:relative;color:var(--paper);font-weight:400;font-size:clamp(17px,1.6vw,22px);}
  .points li::before{content:"";position:absolute;left:0;top:.5em;width:12px;height:12px;border-radius:50%;background:var(--sun);}
  .points li strong{display:block;color:var(--paper);font-weight:700;margin-bottom:6px;font-size:clamp(20px,2vw,28px);line-height:1.25;}
  /* business types slide */
  .slide.centered{align-items:center;text-align:center;}
  .slide.centered .eyebrow::after{margin-left:auto;margin-right:auto;}
  .types{margin-top:8px;display:flex;flex-wrap:wrap;justify-content:center;column-gap:0;row-gap:8px;max-width:940px;margin-left:auto;margin-right:auto;}
  .types .t{font-weight:300;font-size:clamp(24px,3.4vw,44px);line-height:1.3;white-space:nowrap;}
  .types .t.y{color:var(--sun);}
  .types .t+.t::before{content:"·";color:var(--sun-soft);margin:0 22px;}
  /* gaps (problem items) */
  .gaps{display:flex;flex-direction:column;gap:30px;}
  .gap{display:grid;grid-template-columns:48px 1fr;align-items:baseline;row-gap:6px;}
  .gap .n{grid-column:1;grid-row:1;font-weight:700;font-size:20px;color:var(--sun);}
  .gap h3{grid-column:2;grid-row:1;font-weight:700;font-size:clamp(20px,2vw,28px);margin:0;}
  .gap p{grid-column:2;grid-row:2;margin:0;color:var(--paper);font-weight:400;font-size:clamp(16px,1.5vw,21px);}
  /* chat mock */
  .chat{display:flex;flex-direction:column;gap:14px;margin-top:34px;}
  .msg{display:flex;gap:10px;align-items:flex-end;}
  .msg.guest{flex-direction:row-reverse;}
  .avatar{
    flex:0 0 36px;width:36px;height:36px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;overflow:hidden;
  }
  .avatar.user{background:var(--paper);color:var(--ink);}
  .avatar.user svg{width:20px;height:20px;}
  .avatar.bot{background:var(--navy);}
  .avatar.bot img{width:20px;height:20px;object-fit:contain;}
  .bubble{max-width:82%;padding:13px 17px;font-size:17px;font-weight:400;line-height:1.5;border:1px solid var(--hairline);}
  .msg.guest .bubble{background:var(--paper);color:var(--navy);border-color:transparent;border-radius:16px 16px 4px 16px;}
  .msg.bot .bubble{background:var(--panel);color:var(--paper);border-radius:16px 16px 16px 4px;}
  .slide .chat .msg{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease;}
  .slide.active .chat .msg{opacity:1;transform:none;}
  .slide.active .chat .msg:nth-child(1){transition-delay:.5s;}
  .slide.active .chat .msg:nth-child(2){transition-delay:1.15s;}
  .slide.active .chat .msg:nth-child(3){transition-delay:1.8s;}
  /* phone mock (bookings screen) */
  /* device mockups (cover) */
  .devices{position:relative;max-width:580px;margin-left:auto;padding:0 0 52px 56px;color:#1C2333;}
  .ipad{background:#0F1730;border-radius:26px;padding:12px;box-shadow:0 24px 60px rgba(18,24,58,.35);}
  .ipad .scr{background:#F3F5FA;border-radius:16px;padding:14px;height:340px;overflow:hidden;box-sizing:border-box;}
  .iphone{position:absolute;left:0;bottom:0;width:205px;background:#0F1730;border-radius:30px;padding:9px;box-shadow:0 24px 50px rgba(18,24,58,.4);}
  .iphone .scr{background:#F3F5FA;border-radius:22px;padding:12px 10px;height:315px;overflow:hidden;box-sizing:border-box;}
  .dash-top{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:#101528;margin:0 2px 10px;}
  .dash-top span{color:#6B7FC4;}
  .week{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;height:calc(100% - 30px);}
  .day{background:#fff;border-radius:10px;padding:5px 4px;overflow:hidden;}
  .day b{font-size:9px;color:#3A4260;display:block;text-align:center;margin-bottom:5px;font-weight:700;}
  .evt{border-radius:6px;margin:0 1px 5px;font-size:8px;line-height:1.25;padding:4px 5px;color:#fff;font-weight:700;overflow:hidden;}
  .evt.a{background:#6B7FC4;}
  .evt.b{background:#8B9BD8;}
  .evt.c{background:#4C5FA8;}
  .evt.y{background:#FFE300;color:#232B5E;}
  .ph-title{font-weight:700;font-size:16px;text-align:center;margin:0 0 12px;color:#101528;}
  .ph-tabs{display:flex;gap:8px;margin-bottom:12px;}
  .ph-tab{flex:1;text-align:center;font-size:12px;font-weight:700;padding:8px 0;border-radius:10px;background:#E9ECF5;color:#3A4260;}
  .ph-tab.on{background:var(--ink);color:#fff;}
  .ph-card{background:#fff;border-radius:14px;padding:13px 15px;margin-bottom:9px;box-shadow:0 2px 8px rgba(18,24,58,.06);}
  .ph-row{display:flex;justify-content:space-between;align-items:center;gap:8px;}
  .ph-nm{font-weight:700;font-size:14px;}
  .ph-chip{font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;background:#E4E9FB;color:#4353A8;white-space:nowrap;}
  .ph-svc{font-size:12.5px;color:#3A4260;margin-top:3px;}
  .ph-meta{font-size:11.5px;color:#8A90A6;margin-top:2px;}
  .ph-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;}
  .ph-act{font-size:10.5px;font-weight:700;padding:6px 12px;border-radius:999px;}
  .ph-act.g{background:#DDF5E4;color:#177245;}
  .ph-act.n{background:#EEF0F6;color:#3A4260;}
  .ph-act.r{background:#FBE2E2;color:#B3261E;}
  /* section dividers */
  .divider{align-items:center;text-align:center;}
  .appbg{position:absolute;inset:-12%;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .appbg .board{width:100%;max-width:1200px;background:#F3F5FA;border-radius:28px;padding:28px;transform:rotate(-4deg);color:#1C2333;}
  .appbg .week{grid-template-columns:repeat(7,1fr);gap:12px;height:64vh;}
  .appbg .day b{font-size:12px;}
  .appbg .evt{font-size:10px;padding:6px 7px;border-radius:8px;}
  .appbg .bookmock{width:74%;max-width:780px;background:#F3F5FA;border-radius:26px;padding:26px;transform:rotate(3deg);color:#1C2333;}
  .bm-head{display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px;color:#101528;}
  .bm-head span{font-size:12px;color:#6B7FC4;}
  .bm-svc{display:flex;justify-content:space-between;background:#fff;border-radius:12px;padding:12px 14px;margin-top:12px;font-size:13px;font-weight:700;color:#3A4260;}
  .bm-svc i{font-style:normal;color:#8A90A6;font-weight:500;}
  .slots{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}
  .slot{padding:9px 16px;border-radius:999px;background:#fff;color:#3A4260;font-weight:700;font-size:12.5px;border:1px solid #E2E6F2;}
  .slot.on{background:#6B7FC4;color:#fff;border-color:#6B7FC4;}
  .divider .shade{position:absolute;inset:0;background:linear-gradient(160deg,rgba(78,95,160,.88),rgba(107,127,196,.94));}
  .divider .inner{position:relative;z-index:1;}
  .divider h2{font-size:clamp(40px,5.4vw,72px);}
  .divider .lede{margin:20px auto 0;}
  /* pricing */
  .plans{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .plan{position:relative;border:1px solid var(--hairline);padding:18px 20px 16px;background:var(--panel-2);border-radius:14px;}
  .plan.hi{border-color:var(--sun-soft);background:var(--panel);}
  .pop{position:absolute;top:-11px;right:14px;background:var(--sun);color:var(--navy);font-size:10px;font-weight:700;letter-spacing:.08em;padding:4px 11px;border-radius:999px;text-transform:uppercase;}
  .plan .name{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--sun);font-weight:700;}
  .plan .price{font-weight:700;font-size:clamp(22px,2vw,28px);margin:4px 0 0;font-variant-numeric:tabular-nums;}
  .plan .price small{font-size:13px;font-weight:400;color:var(--slate);}
  .plan .aud{margin:2px 0 0;color:var(--slate);font-weight:400;font-size:clamp(13px,1.1vw,15px);}
  .plan p{margin:8px 0 0;color:var(--paper);font-weight:400;font-size:clamp(14px,1.25vw,17px);line-height:1.45;}
  /* store badges + download note */
  .dl-note{margin:26px 0 0;font-size:clamp(16px,1.5vw,20px);font-weight:400;color:var(--paper-dim);text-align:center;max-width:24em;}
  .store-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:16px;}
  .store{display:inline-flex;align-items:center;gap:9px;background:#101528;color:#fff;border-radius:999px;padding:13px 24px;text-decoration:none;font-weight:700;font-size:15px;}
  .store svg{width:19px;height:19px;fill:#fff;}
  .store:focus-visible{outline:2px solid var(--sun);outline-offset:3px;}
  /* CTA */
  .cta-col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
  .cta-col .btn{width:300px;box-sizing:border-box;}
  .btn{
    display:inline-block;padding:16px 36px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;
    text-decoration:none;font-weight:700;border-radius:999px;text-align:center;
  }
  .btn.gold{background:var(--sun);color:var(--navy);}
  .btn.dark{background:var(--panel);color:var(--paper);border:1px solid var(--hairline);}
  .btn:focus-visible{outline:2px solid var(--sun);outline-offset:3px;}
  .cover-mark{font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:var(--sun);margin-bottom:30px;font-weight:400;}
  .cover-rule{width:64px;height:1px;background:var(--hairline);margin:34px 0;}
  /* responsive — phones keep the full-screen swipe deck */
  @media (max-width:900px){
    body{font-size:16px;}
    .slide{padding:86px 6vw 72px;}
    .inner{max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;}
    h1,h2{font-size:31px;}
    .divider h2{font-size:32px;}
    .split{grid-template-columns:1fr;gap:24px;}
    .eyebrow{font-size:17px;letter-spacing:.08em;margin:0 0 16px;}
    .eyebrow::after{margin-top:8px;width:40px;}
    .lede{font-size:17px;margin-top:12px;}
    .kicker{font-size:19px;margin-top:18px;padding-top:12px;max-width:none;}
    .points{gap:18px;}
    .points li{font-size:15px;padding-left:22px;}
    .points li strong{font-size:17px;margin-bottom:3px;}
    .points li::before{width:9px;height:9px;top:.45em;}
    .types .t{font-size:30px;}
    .gaps{gap:16px;}
    .gap{grid-template-columns:30px 1fr;row-gap:3px;}
    .gap .n{font-size:15px;}
    .gap h3{font-size:17px;}
    .gap p{font-size:14px;}
    .plans{grid-template-columns:1fr;gap:10px;}
    .plan{padding:12px 14px 11px;}
    .plan .name{font-size:11px;}
    .plan .price{font-size:18px;}
    .plan .aud{font-size:12px;}
    .plan p{font-size:13px;margin-top:4px;}
    .pop{top:-9px;font-size:9px;padding:3px 9px;}
    .dl-note{font-size:15px;margin-top:16px;}
    .store{padding:11px 18px;font-size:13px;}
    .store svg{width:16px;height:16px;}
    .chat{gap:10px;margin-top:16px;}
    .bubble{font-size:14px;padding:10px 14px;}
    .avatar{flex-basis:28px;width:28px;height:28px;}
    .avatar.user svg{width:15px;height:15px;}
    .avatar.bot img{width:15px;height:15px;}
    .devices{max-width:100%;margin:6px 0 0;padding:0 0 36px 34px;}
    .ipad .scr{height:225px;padding:10px;}
    .iphone{width:135px;padding:7px;border-radius:22px;}
    .iphone .scr{height:205px;padding:9px 7px;border-radius:16px;}
    .week{gap:5px;}
    .evt{font-size:6.5px;padding:3px 4px;margin-bottom:4px;}
    .day b{font-size:7.5px;}
    .types .t{font-size:19px;}
    .types .t+.t::before{margin:0 10px;}
    .appbg .board{padding:16px;border-radius:18px;}
    .appbg .week{height:70vh;gap:6px;}
    .appbg .bookmock{width:92%;padding:16px;}
    .cover-mark{font-size:14px;letter-spacing:.12em;margin-bottom:12px;}
    .cover-rule{margin:16px 0;}
    .cta-col{height:auto;gap:10px;margin-top:8px;}
    .cta-col .btn{width:100%;}
    .btn{padding:13px 20px;font-size:12px;letter-spacing:.1em;}
    .arrow{display:none;}
    .chrome{padding:12px 16px;}
    .wordmark{font-size:9px;letter-spacing:.1em;gap:7px;}
    .wordmark img{height:13px;}
    .counter{font-size:10px;}
    .brandbar{top:10px;left:14px;}
    .brandbar img{height:24px;}
    .langswitch{top:10px;right:12px;padding:3px;}
    .langswitch button{padding:5px 10px;font-size:10px;}
  }
  @media (prefers-reduced-motion:reduce){
    .slide,.slide .chat .msg,.progress{transition:none !important;}
  }

  /* ---------- uploadable imagery wells ---------- */
  [data-slot]{position:relative;}
  [data-slot].has-media>*:not(.da-media):not(.da-tools){display:none!important;}
  [data-slot][data-fit="cover"] .da-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
  [data-slot][data-fit="flow"] .da-media{display:block;width:100%;max-height:32vh;object-fit:cover;border-radius:16px;}
  .img-well{margin-top:22px;}
  .img-well:not(.has-media){display:none;}
  .bgwell{position:absolute;inset:0;z-index:0;overflow:hidden;}
  .bgwell.has-media::after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(24,31,74,.55),rgba(24,31,74,.8));}
  .slide>.inner{position:relative;z-index:1;}
  .da-busy{opacity:.55;}
  /* feature layout: text left, image right */
  .split.feature{grid-template-columns:1.05fr .95fr;align-items:center;}
  .feature-media .img-well{margin-top:0;}
  .feature-media .img-well .da-media{max-height:62vh;border-radius:18px;}
  .feature-media .img-well:not(.has-media){min-height:340px;}
  /* platform overview grid */
  .split.overview{grid-template-columns:.85fr 1.15fr;align-items:start;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px 30px;}
  .feat b{display:block;position:relative;padding-left:22px;font-weight:700;font-size:clamp(15px,1.35vw,20px);line-height:1.25;}
  .feat b::before{content:"";position:absolute;left:0;top:.42em;width:10px;height:10px;border-radius:50%;background:var(--sun);}
  .feat p{margin:3px 0 0 22px;font-size:clamp(13px,1.05vw,15px);color:var(--slate);font-weight:400;line-height:1.4;}
  @media (max-width:900px){.grid2{grid-template-columns:1fr;gap:12px;}.feat b{font-size:15px;}.feat p{font-size:13px;}.feature-media .img-well:not(.has-media){min-height:160px;}}
`;
