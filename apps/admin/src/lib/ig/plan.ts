/* Instagram posting plan: 40 feed posts + their matching stories, 14 weeks, Mon/Wed/Fri.
   Source of truth for the publisher cron. Generated from the POSTING-PLAN.md that ships with the asset zips. */

export type PlanDay = 'Mon' | 'Wed' | 'Fri';

export interface PlanRow {
  week: number;
  day: PlanDay;
  set: 1 | 2;
  file: string;
  vertical: string;
  sr: string;
  en: string;
}

export const PLAN: PlanRow[] = [
  { week: 1, day: 'Mon', set: 1, file: '01-hook-20s', vertical: 'salon', sr: 'Klijenti zakazuju za 20 sekundi. I u 23h. Bez poziva, bez poruka napred-nazad — termin se sam pojavi u vašem kalendaru. Besplatna stranica za zakazivanje za vaš salon.', en: 'Customers book in 20 seconds. Even at 11pm. No calls, no back-and-forth — the appointment just appears in your calendar. Free booking page for your salon.' },
  { week: 1, day: 'Wed', set: 2, file: '02-yoga-card', vertical: 'yoga', sr: 'Čas joge zakazan dok se kafa hladi. Online zakazivanje, 24/7.', en: 'A yoga class booked before the coffee cools. Online booking, 24/7.' },
  { week: 1, day: 'Fri', set: 1, file: '05-phone-chat', vertical: 'all', sr: 'Klijent piše. Balkina zakazuje. „Šišanje sutra posle 17h?“ → „Sutra u 17:00 kod Marka je slobodno.“ → Potvrđeno. Bez vašeg učešća.', en: 'The customer writes. Balkina books. "Haircut tomorrow after 5pm?" → "5:00pm with Marko is free." → Confirmed. Without you lifting a finger.' },
  { week: 2, day: 'Mon', set: 2, file: '07-tennis-split', vertical: 'tennis', sr: 'Čas tenisa zakazan za 20 sekundi. Bez poziva. Potvrda odmah, podsetnik dan ranije.', en: 'A tennis lesson booked in 20 seconds. No calls. Confirmation now, reminder the day before.' },
  { week: 2, day: 'Wed', set: 1, file: '09-photo-barber', vertical: 'barber', sr: 'Za frizere i barbere: puna stolica, bez propuštenih poziva. Klijent bira termin sam, vi dobijate obaveštenje na telefon. Aktivacija je besplatna i traje 10 sekundi.', en: 'For barbers and hair salons: full chair, no missed calls. The customer picks the slot, you get a notification on your phone. Activation is free and takes 10 seconds.' },
  { week: 2, day: 'Fri', set: 2, file: '17-steps', vertical: 'all', sr: 'Tri koraka do punog kalendara: aktivirajte stranicu (besplatno, 10 sekundi), podelite link, klijenti zakazuju. Vi dobijate obaveštenje.', en: 'Three steps to a full calendar: activate your page (free, 10 seconds), share the link, clients book. You get a notification.' },
  { week: 3, day: 'Mon', set: 1, file: '02-hook-reminder', vertical: 'all', sr: 'Manje nedolazaka. Svaki klijent dobija SMS potvrdu odmah i podsetnik dan ranije — automatski. Vi ne radite ništa.', en: 'Fewer no-shows. Every customer gets an SMS confirmation right away and a reminder the day before — automatically. You do nothing.' },
  { week: 3, day: 'Wed', set: 2, file: '10-pilates-duo', vertical: 'pilates', sr: 'Reformer je slobodan u 9. Vaš klijent to već zna. Slobodni termini vidljivi odmah, bez poruka napred-nazad.', en: 'The reformer is free at 9. Your client already knows. Free slots visible instantly, no back-and-forth.' },
  { week: 3, day: 'Fri', set: 1, file: '06-phone-push', vertical: 'all', sr: 'Svaka rezervacija stiže odmah, na vaš telefon. Odobrite, pomerite ili pošaljite poruku jednim dodirom.', en: 'Every booking lands instantly, on your phone. Approve, move or message in one tap.' },
  { week: 4, day: 'Mon', set: 2, file: '08-spa-split', vertical: 'spa', sr: 'Opuštanje se zakazuje. Bez poziva. Klijenti biraju tretman i vreme sami, i u 23h.', en: 'Relaxation, booked. No calls. Clients choose the treatment and time themselves, even at 11pm.' },
  { week: 4, day: 'Wed', set: 1, file: '11-photo-nails', vertical: 'nails', sr: 'Za nail studije: termin za 20 sekundi, podsetnik dan ranije. Manje praznih termina, manje nedolazaka.', en: 'For nail studios: booked in 20 seconds, reminded the day before. Fewer empty slots, fewer no-shows.' },
  { week: 4, day: 'Fri', set: 2, file: '19-qa', vertical: 'all', sr: '„Da li moram da menjam način rada?“ Ne. Radite kao i do sada. Balkina samo puni kalendar i javlja vam na telefon.', en: '"Do I have to change how I work?" No. Work exactly as you do today. Balkina just fills the calendar and pings your phone.' },
  { week: 5, day: 'Mon', set: 1, file: '03-hook-one-link', vertical: 'barber', sr: 'Jedan link za Instagram i Google. Stavite ga u bio i na Google profil — klijenti zakazuju bez da vas zovu.', en: 'One link for Instagram and Google. Put it in your bio and on your Google profile — customers book without calling you.' },
  { week: 5, day: 'Wed', set: 2, file: '04-fit-framed', vertical: 'fitness', sr: 'Treninzi koji se ne otkazuju u poslednji čas. SMS podsetnik dan ranije: manje nedolazaka, puniji dan.', en: 'Sessions that don\'t cancel at the last minute. SMS reminder the day before: fewer no-shows, fuller days.' },
  { week: 5, day: 'Fri', set: 1, file: '07-phone-confirmed', vertical: 'all', sr: 'Potvrda odmah. Podsetnik dan ranije. Klijent tačno zna kad, kod koga i koliko košta.', en: 'Confirmation right away. Reminder the day before. The customer knows exactly when, with whom and how much.' },
  { week: 6, day: 'Mon', set: 2, file: '11-lashes-card', vertical: 'lashes', sr: 'Trepavice za sredu, zakazane u nedelju uveče. Zakazivanje radi i kad vi ne radite.', en: 'Lashes for Wednesday, booked Sunday night. Booking works even when you don\'t.' },
  { week: 6, day: 'Wed', set: 2, file: '16-stat-247', vertical: 'all', sr: 'Zakazivanje 24/7. I kad je zatvoreno. Nedeljom. U ponoć. Na odmoru.', en: 'Booking 24/7. Even when closed. On Sundays. At midnight. On holiday.' },
  { week: 6, day: 'Fri', set: 1, file: '10-photo-salon', vertical: 'salon', sr: 'Za salone lepote: klijentkinje zakazuju dok vi radite. Farbanje, šišanje, feniranje — sve online, 24/7.', en: 'For beauty salons: clients book while you work. Colour, cuts, blow-dries — all online, 24/7.' },
  { week: 7, day: 'Mon', set: 1, file: '04-hook-while-you-work', vertical: 'salon', sr: 'Dok vi radite, Balkina zakazuje. Stranica za zakazivanje koja radi i kad je salon zatvoren.', en: 'While you work, Balkina books. A booking page that works even when the salon is closed.' },
  { week: 7, day: 'Wed', set: 2, file: '01-yoga-split', vertical: 'yoga', sr: 'Prostirka je rezervisana. Pre nego što zaboravite. Klijenti biraju čas sami, u par sekundi — vi vidite ko dolazi.', en: 'Mat reserved. Before you forget. Clients pick a class themselves, in seconds — you see who\'s coming.' },
  { week: 7, day: 'Fri', set: 1, file: '08-phone-calendar', vertical: 'all', sr: 'Vaš dan, na jednom mestu. Ko dolazi, kada i za šta — u aplikaciji, uvek sa vama.', en: 'Your day, in one place. Who\'s coming, when and for what — in the app, always with you.' },
  { week: 8, day: 'Mon', set: 2, file: '12-makeup-split', vertical: 'makeup', sr: 'Za svaki važan dan, termin u par sekundi. Šminka, frizura, nokti — sve na jednom linku.', en: 'For every big day, a slot in seconds. Makeup, hair, nails — all on one link.' },
  { week: 8, day: 'Wed', set: 1, file: '14-photo-customer', vertical: 'all', sr: 'Vaši klijenti već sve zakazuju online. Dajte im i vaš salon. Jedan link je dovoljno.', en: 'Your customers already book everything online. Give them your salon too. One link is enough.' },
  { week: 8, day: 'Fri', set: 2, file: '20-cta', vertical: 'all', sr: 'Besplatno. Bez kartice. 10 sekundi. Napravite svoju stranicu → link u biu.', en: 'Free. No card. 10 seconds. Create your page → link in bio.' },
  { week: 9, day: 'Mon', set: 1, file: '20-qa-noshow', vertical: 'nails', sr: '„Šta ako klijent ne dođe?“ SMS podsetnik dan ranije drastično smanjuje nedolaske. Po želji, tražite depozit unapred.', en: '"What if a customer doesn\'t show up?" An SMS reminder the day before cuts no-shows sharply. If you want, ask for a deposit upfront.' },
  { week: 9, day: 'Wed', set: 2, file: '06-tennis-card', vertical: 'tennis', sr: 'Teren, trener, termin. Jedan link — u Instagram biu, na Google profilu, na WhatsAppu.', en: 'Court, coach, time. One link — in your Instagram bio, on Google, on WhatsApp.' },
  { week: 9, day: 'Fri', set: 1, file: '16-checklist', vertical: 'nails', sr: 'Sve što salonu treba: online zakazivanje 24/7, SMS potvrde i podsetnici, kalendar u aplikaciji, podsetnik klijentu kad je vreme za novi termin.', en: 'Everything a salon needs: online booking 24/7, SMS confirmations and reminders, calendar in the app, a rebooking nudge for the customer.' },
  { week: 10, day: 'Mon', set: 2, file: '03-yoga-circle', vertical: 'yoga', sr: 'Mir počinje jednim klikom. Zakazivanje bez poziva i poruka.', en: 'Calm starts with one tap. Booking without calls or messages.' },
  { week: 10, day: 'Wed', set: 1, file: '13-photo-beard', vertical: 'barber', sr: 'Makaze u ruci. Telefon na miru. Zakazivanje radi samo od sebe.', en: 'Scissors in hand. Phone at peace. Booking runs by itself.' },
  { week: 10, day: 'Fri', set: 2, file: '18-chat', vertical: 'yoga', sr: 'Klijent piše. Balkina zakazuje. „Joga sutra ujutru?“ → „Sutra u 8:00 ima mesta.“ → Rezervisano.', en: 'The client writes. Balkina books. "Yoga tomorrow morning?" → "8:00 has space." → Reserved.' },
  { week: 11, day: 'Mon', set: 1, file: '12-photo-massage', vertical: 'spa', sr: 'Za masaže i spa: mir u salonu, red u kalendaru. Klijenti biraju slobodan termin sami, vi samo potvrdite.', en: 'For massage and spa: calm in the room, order in the calendar. Clients pick a free slot themselves, you just confirm.' },
  { week: 11, day: 'Wed', set: 1, file: '15-steps', vertical: 'all', sr: 'Kako radi, u tri koraka: 1) aktivirajte stranicu (besplatno, bez kartice) 2) podelite link — Instagram bio, Google profil, WhatsApp 3) klijenti zakazuju 24/7, vi dobijate obaveštenje. To je sve.', en: 'How it works, in three steps: 1) activate your page (free, no card) 2) share the link — Instagram bio, Google profile, WhatsApp 3) customers book 24/7, you get a notification. That\'s it.' },
  { week: 11, day: 'Fri', set: 2, file: '09-spa-card', vertical: 'spa', sr: 'Sjaj za sutra, zakazan večeras. Vaši tretmani, online, 24/7.', en: 'Tomorrow\'s glow, booked tonight. Your treatments, online, 24/7.' },
  { week: 12, day: 'Mon', set: 1, file: '19-qa-change', vertical: 'salon', sr: '„Da li moram da menjam način rada?“ Ne. Radite kao i do sada. Balkina samo puni kalendar i javlja vam na telefon.', en: '"Do I have to change how I work?" No. Work exactly as you do today. Balkina just fills the calendar and pings your phone.' },
  { week: 12, day: 'Wed', set: 2, file: '13-editorial', vertical: 'salon', sr: 'Zakazano. Dok vi radite, Balkina puni kalendar.', en: 'Booked. While you work, Balkina fills the calendar.' },
  { week: 12, day: 'Fri', set: 2, file: '05-fit-split', vertical: 'fitness', sr: 'Puni termini, prazan inbox. Klijenti zakazuju sami. Vi samo trenirate.', en: 'Full slots, empty inbox. Clients book themselves. You just coach.' },
  { week: 13, day: 'Mon', set: 1, file: '18-stat-247', vertical: 'all', sr: '24/7. Zakazivanje radi i kad je salon zatvoren. Nedeljom. U ponoć. Na odmoru.', en: '24/7. Booking works even when the salon is closed. On Sundays. At midnight. On holiday.' },
  { week: 13, day: 'Wed', set: 2, file: '14-fashion-circle', vertical: 'beauty', sr: 'Vaše klijentkinje već sve zakazuju online. Dajte im i vaš salon. Jedan link je dovoljno.', en: 'Your clients already book everything online. Give them your salon too. One link is enough.' },
  { week: 13, day: 'Fri', set: 1, file: '17-cta-free', vertical: 'all', sr: 'Besplatno za početak. Bez kartice. Aktivacija za 10 sekundi. Napravite stranicu za svoj salon → link u biu.', en: 'Free to start. No card. Activate in 10 seconds. Create your salon page → link in bio.' },
  { week: 14, day: 'Mon', set: 2, file: '15-fashion-card', vertical: 'pilates', sr: 'Dobar dan počinje potvrđenim terminom. Potvrda odmah, podsetnik dan ranije.', en: 'A good day starts with a confirmed appointment. Confirmation now, reminder the day before.' },
];

const DAY_OFFSET: Record<PlanDay, number> = { Mon: 0, Wed: 2, Fri: 4 };
const DAY_BY_WEEKDAY: Record<number, PlanDay | undefined> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

const HASHTAGS: Record<string, string[]> = {
  salon: ['#frizerskisalon', '#salonlepote', '#hairsalon', '#frizer'],
  barber: ['#barbershop', '#frizerskisalon', '#barber', '#brada'],
  nails: ['#nokti', '#manikir', '#nailstudio', '#salonlepote'],
  spa: ['#spa', '#masaza', '#wellness', '#relax'],
  lashes: ['#trepavice', '#lashes', '#obrve', '#salonlepote'],
  makeup: ['#sminka', '#makeup', '#mua', '#salonlepote'],
  beauty: ['#salonlepote', '#beautysalon', '#lepota'],
  yoga: ['#joga', '#yoga', '#jogastudio', '#wellness'],
  fitness: ['#fitnes', '#personaltrainer', '#teretana', '#trening'],
  pilates: ['#pilates', '#reformer', '#fitnes'],
  tennis: ['#tenis', '#tennis', '#teniskiklub', '#trener'],
  all: ['#malibiznis', '#preduzetnistvo', '#zakazivanje'],
};
const BRAND_TAGS = ['#zakazivanje', '#onlinezakazivanje', '#balkina', '#booking'];
const PLACE_TAGS = ['#crnagora', '#podgorica', '#budva', '#bar', '#beograd', '#novisad'];

/** 8-10 hashtags for a vertical: its own tags, the brand tags, and two rotating place tags picked by `seed`. */
export function hashtagsFor(vertical: string, seed: number): string[] {
  const own = HASHTAGS[vertical] ?? HASHTAGS.all ?? [];
  const places = [PLACE_TAGS[seed % PLACE_TAGS.length], PLACE_TAGS[(seed + 3) % PLACE_TAGS.length]].filter((t): t is string => Boolean(t));
  return Array.from(new Set([...own, ...BRAND_TAGS, ...places])).slice(0, 10);
}

/** Caption for the feed post: Serbian, a divider, English, the CTA, then 8-10 rotating hashtags. */
export function buildCaption(row: PlanRow, index: number): string {
  return `${row.sr}\n—\n${row.en}\n\nLink u biu → balkina.ai\n\n${hashtagsFor(row.vertical, index).join(' ')}`;
}

/** Local calendar date (YYYY-MM-DD) and ISO weekday for a timezone. */
export function localDate(now: Date, timeZone: string): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { date, weekday };
}

/** Scheduled calendar date for a row, given the Monday the plan starts on. */
export function rowDate(row: PlanRow, start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (row.week - 1) * 7 + DAY_OFFSET[row.day]);
  return d.toISOString().slice(0, 10);
}

/** The row scheduled for a given local date, or null when nothing is due. */
export function rowForDate(date: string, start: string): { row: PlanRow; index: number } | null {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (Number.isNaN(ms) || ms < 0) return null;
  const days = Math.round(ms / 86_400_000);
  const week = Math.floor(days / 7) + 1;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const day = DAY_BY_WEEKDAY[weekday];
  if (!day) return null;
  const index = PLAN.findIndex((r) => r.week === week && r.day === day);
  const row = PLAN[index];
  return row ? { row, index } : null;
}

export function assetUrl(row: PlanRow, kind: 'sq' | 'st', base: string, lang = 'sr'): string {
  return `${base.replace(/\/$/, '')}/set${row.set}/${kind}/${lang}/${row.file}.jpg`;
}
