/* What the studio copywriter knows: (1) each audience — who books with them, what gets booked, and moments
   of their working day; (2) every Balkina capability worth an ad (OPPORTUNITIES). A post promises the OWNER
   one capability, worded for their trade. Scenes are written in English (the model localises them); `ask`
   and `words` are Montenegrin, as the owner hears them every day. */
import type { Lang } from './categories';

export interface AudienceProfile {
  /** What the owner calls the people who book (plural). */
  customer: Record<Lang, string>;
  /** What gets booked, in the trade's own words. */
  books: Record<Lang, string>;
  /** What the owner's hands are doing when the phone rings. */
  busy: string;
  /** When their customers decide to book. */
  when: string;
  /** What a forgotten booking costs them. */
  noshow: string;
  /** The message they answer all day, as customers write it. */
  ask: string;
  /** Trade words that make the Serbian sound native. */
  words: string;
}

const P = (customer: [string, string], books: [string, string], busy: string, when: string, noshow: string, ask: string, words: string): AudienceProfile =>
  ({ customer: { en: customer[0], sr: customer[1] }, books: { en: books[0], sr: books[1] }, busy, when, noshow, ask, words });

export const AUDIENCES: Record<string, AudienceProfile> = {
  // health
  massage: P(['clients', 'klijenti'], ['a massage', 'termin za masažu'], 'hands oiled, mid-massage, the phone buzzing on the shelf', 'late in the evening, after a day at the desk with a stiff neck', 'a 60-minute slot and a warmed-up room standing empty', 'Imate li slobodan termin sjutra poslije posla?', 'masaža, tretman, sportska masaža, relaks'),
  physio: P(['patients', 'pacijenti'], ['a therapy session', 'termin za terapiju'], 'mid-treatment, a patient on the table', 'the evening the back pain flares up again', 'a patient skipping one session of a ten-session plan, leaving a hole in the day', 'Kad mogu da dođem na terapiju?', 'terapija, vježbe, rehabilitacija, pacijent'),
  yoga: P(['students', 'polaznici'], ['a spot in a class', 'mjesto na času'], 'leading a class, phone silenced in the other room', 'on Sunday evening, planning the week ahead', 'a reserved mat left empty while others were turned away', 'Ima li mjesta na času u 19h?', 'čas, prostirka, grupa, mjesto'),
  pilates: P(['clients', 'klijenti'], ['a reformer spot', 'mjesto na reformeru'], 'correcting a posture on the reformer, phone out of reach', 'at 11 pm, right after seeing your reel', 'one of only a few reformers empty for the whole hour', 'Ima li slobodan reformer u srijedu ujutro?', 'reformer, čas, grupa, termin'),
  counseling: P(['clients', 'klijenti'], ['a session', 'termin za razgovor'], 'in session, phone off for fifty minutes', 'late at night, when they finally gather the courage to ask for help', 'a fifty-minute session nobody else could take', 'Kako mogu da zakažem prvi razgovor?', 'seansa, razgovor, prvi termin, diskretno'),
  // beauty
  salon: P(['clients', 'klijentkinje'], ['a cut or colour', 'termin za šišanje ili farbanje'], 'hands full of colour and foil, the phone ringing by the mirror', 'on Sunday night, or the week before a wedding', 'a two-hour colour slot empty on a Saturday', 'Imate li termin u subotu prijepodne?', 'šišanje, farbanje, feniranje, pramenovi, termin'),
  barber: P(['customers', 'mušterije'], ['a cut or beard trim', 'termin za šišanje ili bradu'], 'mid-fade, clippers in hand', 'on Friday afternoon, before going out', 'an empty chair for thirty minutes on a Saturday', 'Brate, imaš li termin danas?', 'fejd, brada, šišanje, stolica, mušterija'),
  nails: P(['clients', 'klijentkinje'], ['a manicure', 'termin za manikir'], "holding a client's hand under the lamp, brush in the other hand", 'the night before a holiday or an event', 'a ninety-minute gel set nobody else could take', 'Ima li termin za korekciju ove sedmice?', 'manikir, gel, korekcija, nadogradnja, lampa'),
  lashes: P(['clients', 'klijentkinje'], ['a lash set or refill', 'termin za trepavice ili korekciju'], "tweezers in both hands, the client's eyes closed for ninety minutes", 'at midnight, after seeing your work on Instagram', 'a two-hour full set gone', 'Kad imate termin za korekciju?', 'trepavice, korekcija, lash lift, obrve, laminacija'),
  makeup: P(['clients', 'klijentkinje'], ['a makeup appointment', 'termin za šminkanje'], "doing a bride's eyes at seven in the morning", 'months ahead for weddings and proms, in a rush before a night out', 'a blocked Saturday morning in wedding season', 'Jeste li slobodni 15. juna za vjenčanje?', 'šminkanje, mlada, matura, proba šminke'),
  spa: P(['guests', 'gosti'], ['a treatment', 'tretman'], 'at the front desk, juggling the phone and guests walking in', 'in the evening, planning a weekend or a gift', 'a treatment room and a therapist idle for an hour', 'Imate li slobodan termin za dvoje u subotu?', 'tretman, masaža, sauna, relaks, paket za dvoje'),
  skincare: P(['clients', 'klijenti'], ['a facial', 'tretman lica'], 'gloves on, in the middle of a facial', 'in the evening, in front of the mirror before an event', 'a seventy-five-minute treatment slot lost', 'Kad mogu da dođem na tretman lica?', 'tretman lica, čišćenje lica, njega kože'),
  beauty: P(['clients', 'klijentkinje'], ['a treatment', 'termin'], 'one client under the lamp, another at the door, the phone ringing', 'in the evening, scrolling Instagram', 'a blocked slot that three others asked for', 'Imate li termin sjutra?', 'depilacija, manikir, tretman, obrve, termin'),
  // fitness
  fitness: P(['clients', 'klijenti'], ['a training session', 'termin za trening'], 'spotting a client in the middle of a set', 'on Sunday evening, full of motivation for Monday', 'the 7 am hour you got up for', 'Kad imaš slobodan termin za trening?', 'trening, termin, personalni, klijent'),
  gym: P(['members', 'članovi'], ['a class or a trial session', 'grupni trening ili probni termin'], 'at the front desk in the evening rush', 'late in the evening, deciding to finally start', 'a full class list and half the room empty', 'Ima li mjesta na grupnom treningu večeras?', 'članarina, grupni trening, probni trening'),
  tennis: P(['players', 'igrači'], ['a lesson or a court', 'čas ili teren'], 'on court feeding balls, phone in the bag', 'after work, checking the weather for tomorrow', 'a court hour paid for and empty', 'Imaš li slobodan termin za čas u četvrtak?', 'čas tenisa, teren, termin, trener'),
  dance: P(['students', 'polaznici'], ['a class or a trial lesson', 'čas ili probni čas'], 'counting steps in front of the mirror, music loud', 'in the evening: a couple planning the first dance, a parent enrolling a child', 'a private first-dance lesson nobody came to', 'Kad su časovi za početnike?', 'čas, grupa, probni čas, prvi ples'),
  martial: P(['members', 'članovi'], ['a trial training', 'probni trening'], 'holding pads in the ring', 'in the evening, parents looking for a sport for their kid', 'a private session slot wasted', 'Može li dijete da dođe na probni trening?', 'trening, probni trening, grupa, sala'),
  // home
  cleaning: P(['customers', 'klijenti'], ['a cleaning', 'termin za čišćenje'], "gloves on in someone's flat, vacuum running", 'on Thursday evening, with guests coming for the weekend', 'a crew standing at a locked door', 'Kad možete da dođete na generalno čišćenje?', 'generalno čišćenje, stan, apartman, ekipa'),
  handyman: P(['customers', 'mušterije'], ['a visit', 'dolazak majstora'], 'on a ladder with a drill in hand', 'the moment something breaks, usually in the evening', 'a drive across town to a customer who is not home', 'Majstore, kad možete da dođete?', 'majstor, popravka, montaža, dolazak'),
  plumber: P(['customers', 'mušterije'], ['a visit', 'dolazak'], 'under a sink with wet hands', 'the moment a pipe starts leaking, often at night or on a weekend', 'a drive to an address where nobody opens the door', 'Curi mi česma, kad možete da dođete?', 'kvar, curenje, bojler, intervencija'),
  electrician: P(['customers', 'mušterije'], ['a visit', 'dolazak'], 'inside a switchboard with the power off', 'when the fuse trips, or when a renovation starts', 'a trip to a locked flat', 'Kad možete da pogledate instalaciju?', 'osigurač, instalacija, kvar, utičnica'),
  // professional
  lawyer: P(['clients', 'klijenti'], ['a consultation', 'termin za konsultacije'], 'in court all morning, phone off', 'the evening the problem lands on them, when they finally search for a lawyer', 'a consultation hour kept free for nobody', 'Kad mogu da dođem na konsultacije?', 'konsultacije, sastanak, kancelarija, predmet'),
  accounting: P(['clients', 'klijenti'], ['a consultation', 'termin za konsultacije'], 'in the middle of month-end closing', 'when they open a company, or when a tax deadline gets close', 'an hour reserved in the busiest week of the month', 'Kad možemo da se vidimo oko papira za firmu?', 'knjigovodstvo, konsultacije, završni račun, firma'),
  photographer: P(['clients', 'klijenti'], ['a shoot', 'termin za fotografisanje'], 'behind the camera in the middle of a shoot', 'at night after scrolling your portfolio, months ahead for weddings', 'a studio hour with the lights already set', 'Jeste li slobodni za vjenčanje u septembru?', 'fotografisanje, vjenčanje, studio, termin'),
  realestate: P(['buyers', 'kupci'], ['a viewing', 'termin za razgledanje'], 'showing a flat to another buyer', 'at night, scrolling listings', 'waiting in front of a building for a buyer who never comes', 'Kad mogu da pogledam stan?', 'razgledanje, stan, kupac, oglas'),
  // education
  tutor: P(['students', 'učenici'], ['a lesson', 'čas'], 'mid-lesson, explaining an equation', 'the evening before a test, when parents start texting', 'an hour kept free for a student who forgot', 'Imate li termin za čas matematike prije kontrolnog?', 'čas, kontrolni, priprema, matura'),
  language: P(['students', 'polaznici'], ['a class or a placement test', 'čas ili testiranje'], 'teaching a group, phone on silent', 'in September and January, or right before moving abroad', 'a trial lesson slot wasted', 'Kad počinje kurs njemačkog?', 'kurs, čas, grupa, individualni čas'),
  music: P(['students', 'učenici'], ['a lesson', 'čas'], 'at the piano with a student', 'at the start of the school year, parents in the evening', 'a forty-five-minute gap in the afternoon', 'Imate li termin za čas gitare?', 'čas klavira, gitara, probni čas'),
  driving: P(['candidates', 'kandidati'], ['a driving lesson', 'čas vožnje'], 'in the passenger seat with a candidate at the wheel', 'between classes or after work, by text message', 'a car and an instructor waiting at the pick-up spot', 'Kad mogu da dobijem sljedeći čas vožnje?', 'čas vožnje, kandidat, polaganje, instruktor'),
  swimming: P(['students', 'polaznici'], ['a swimming lesson', 'čas plivanja'], 'in the water with a child', 'before the summer, parents in the evening', 'a paid pool lane left empty', 'Ima li mjesta u školi plivanja?', 'škola plivanja, čas, bazen, grupa'),
  // pets
  grooming: P(['dog owners', 'vlasnici pasa'], ['a grooming', 'termin za šišanje psa'], 'a wet dog on the table, clippers in hand', 'before the holidays, or when the dog starts to smell', 'a two-hour slot kept for a big dog', 'Kad možete da ošišate mog psa?', 'šišanje, kupanje, pas, termin'),
  vet: P(['pet owners', 'vlasnici ljubimaca'], ['a check-up or a vaccination', 'pregled ili vakcinacija'], 'examining a patient on the table', 'in the evening, when they notice something is wrong', 'a vaccination slot empty while the waiting room is full', 'Kad mogu da dovedem mačku na vakcinu?', 'pregled, vakcinacija, ambulanta, ljubimac'),
  dogtraining: P(['dog owners', 'vlasnici pasa'], ['a training session', 'termin za dresuru'], 'in the field with a dog on the leash', 'the evening the puppy chews the sofa', 'an hour in the park waiting for nobody', 'Kad možemo da počnemo sa obukom šteneta?', 'dresura, obuka, štene, poslušnost'),
  // auto
  autorepair: P(['drivers', 'vozači'], ['a service slot', 'termin za servis'], 'under a car on the lift, hands covered in oil', 'when a warning light comes on, or before a long trip', 'a lift kept free all morning', 'Kad mogu da dovezem auto na servis?', 'servis, dijagnostika, registracija, dizalica'),
  carwash: P(['drivers', 'vozači'], ['a wash', 'termin za pranje'], 'pressure washer in hand', 'on Friday afternoon, before the weekend', 'a three-hour detailing slot gone', 'Koliko se čeka? Može li odmah?', 'pranje, dubinsko pranje, usisavanje, poliranje'),
  tires: P(['drivers', 'vozači'], ['a tyre change', 'termin za zamjenu guma'], 'the impact wrench on a wheel', 'at the first snow in November, everyone at once', 'a slot wasted in the two craziest weeks of the year', 'Kad mogu da dođem da zamijenim gume?', 'zimske gume, zamjena guma, balansiranje, sezona'),
  // events
  eventplanner: P(['clients', 'klijenti'], ['a consultation', 'termin za konsultacije'], 'on site on the day of an event', 'in the evening, a couple that just got engaged', 'a consultation evening kept free for nobody', 'Jeste li slobodni za naš datum?', 'vjenčanje, proslava, konsultacije, datum'),
  dj: P(['clients', 'klijenti'], ['a date', 'datum'], 'behind the decks until three, asleep until noon', 'at night, messaging about their date', 'a date held for someone who went silent', 'Jesi li slobodan 20. jula?', 'svadba, žurka, datum, nastup'),
  catering: P(['clients', 'klijenti'], ['a tasting or a planning call', 'degustacija ili dogovor'], 'in the kitchen, plating for eighty people', 'in the evening, weeks before a celebration', 'a tasting prepared for nobody', 'Radite li ketering za 50 ljudi?', 'ketering, degustacija, proslava, meni'),
  // food
  dietitian: P(['clients', 'klijenti'], ['a consultation', 'konsultacije'], 'in a consultation, taking measurements', 'on Monday morning, or right after the holidays', 'an hour-long consultation nobody came to', 'Kad mogu da dođem na prve konsultacije?', 'plan ishrane, konsultacije, mjerenje, kontrola'),
  mealprep: P(['customers', 'klijenti'], ['a first consultation', 'prvi dogovor'], 'packing boxes in the kitchen', 'on Sunday, planning the week', 'a planning slot nobody came to', 'Kako da naručim obroke za sljedeću sedmicu?', 'obroci, plan, dostava, sedmica'),
  chef: P(['clients', 'klijenti'], ['a private dinner', 'privatna večera'], "at the stove in a client's kitchen", 'while planning an anniversary or a villa holiday', 'a Saturday evening kept free for nobody', 'Jeste li slobodni za večeru za 8 osoba u subotu?', 'privatna večera, meni, vila, degustacija'),
  // rentals
  boat: P(['guests', 'gosti'], ['a boat tour', 'izlet brodom'], 'at the helm, out at sea with no signal', 'the night before, from their apartment', 'seats held on a full boat in August', 'Ima li mjesta za sjutra za četvoro?', 'izlet, brod, polazak, mjesta, Plava špilja'),
  tours: P(['guests', 'gosti'], ['a tour', 'tura'], 'leading a group through the old town', 'the night before, from the hotel', 'a group waiting for two people who never came', 'Ima li tura sjutra ujutro?', 'tura, grupa, polazak, vodič'),
  rental: P(['guests', 'gosti'], ['a rental', 'iznajmljivanje'], 'handing a scooter over to a customer', 'in the evening, planning tomorrow', 'a bike held back in high season', 'Imate li slobodan skuter za sjutra?', 'skuter, bicikl, kajak, dan, preuzimanje'),
  // hospitality
  restaurant: P(['guests', 'gosti'], ['a table', 'sto'], 'Friday night service, the phone ringing at the bar', 'in the afternoon, deciding where to eat tonight', 'a table for six held empty on a Saturday night', 'Imate li sto za četvoro večeras u 20h?', 'sto, rezervacija, gosti, večera'),
  cafe: P(['guests', 'gosti'], ['a table', 'sto'], 'behind the espresso machine in the morning rush', 'while planning a brunch or a match night with friends', 'the best table on the terrace held empty', 'Može li rezervacija za branč u nedjelju?', 'sto, bašta, branč, rezervacija'),
  hotel: P(['guests', 'gosti'], ['a spa slot, a table or a trip', 'spa termin, sto ili izlet'], 'at reception with a queue at check-in', 'in their room at night, planning tomorrow', 'a spa room and a therapist idle', 'Može li masaža sjutra u 17h?', 'recepcija, spa, gosti, rezervacija'),
  // generic
  all: P(['clients', 'klijenti'], ['an appointment', 'termin'], 'working with a client, the phone ringing', 'in the evening, when you are closed', 'an empty slot somebody else wanted', 'Imate li slobodan termin?', 'termin, klijenti, zakazivanje'),
};

export const audienceFor = (vertical: string): AudienceProfile => AUDIENCES[vertical] ?? AUDIENCES.all!;

/* ---------- What a post is about: one Balkina capability, promised to the owner ---------- */

/** One idea per post: a capability, the promise it makes to the owner, and how it works. */
export interface Opportunity {
  key: string;
  /** Short name for the admin UI. */
  label: string;
  /** What the headline promises the owner. */
  claim: string;
  /** How it works: the fact the subline carries. Nothing beyond this may be claimed. */
  detail: string;
  /** A part of the audience profile that makes the subline or caption concrete for the trade. */
  scene?: 'busy' | 'when' | 'noshow' | 'ask';
  /** Category keys it applies to (all when omitted). */
  only?: string[];
  /** Category keys it does not apply to. */
  not?: string[];
}

export const OPPORTUNITIES: Opportunity[] = [
  { key: 'ai_discovery', label: 'Found through AI', claim: 'new customers find and book the business through AI', detail: 'in the Balkina app people tell the AI what they need ("a haircut tomorrow after 5"), and the AI finds the business, checks its free times and books', scene: 'when' },
  { key: 'always_open', label: 'Bookings 24/7', claim: 'bookings come in around the clock, also when the business is closed', detail: 'the booking page is open day and night and a booking takes about 20 seconds', scene: 'when' },
  { key: 'no_calls', label: 'No phone calls', claim: 'no more stopping work to answer the phone for bookings', detail: 'customers pick a free time on their own and the owner only gets a notification on the phone', scene: 'busy' },
  { key: 'reminders', label: 'Fewer no-shows', claim: 'fewer no-shows', detail: 'every booking gets an automatic confirmation and a reminder the day before', scene: 'noshow' },
  { key: 'one_link', label: 'One booking link', claim: 'one booking link that works everywhere the business already is', detail: 'the same link goes in the Instagram bio, on the Google profile and in WhatsApp, and customers book straight from it', scene: 'ask' },
  { key: 'free_start', label: 'Free in 10 seconds', claim: 'an online booking page for the business, free, today', detail: 'activation takes about 10 seconds, with no card and nothing to install' },
  { key: 'rebooking', label: 'Regulars come back', claim: 'AI brings regular customers back', detail: "Balkina learns each customer's rhythm and reminds them when it is time to book again" },
  { key: 'approval', label: 'You approve requests', claim: 'the owner stays in control of the calendar', detail: 'with approval turned on, every booking arrives as a request and is confirmed or declined with one tap' },
  { key: 'team', label: 'Team calendars', claim: "the whole team's schedule in one place", detail: 'each team member has their own working hours, days off and services, and customers can choose who they book with', not: ['hospitality'] },
  { key: 'reviews', label: 'Reviews', claim: 'more reviews without asking for them', detail: 'customers are invited to leave a review after their visit, and a better rating ranks the business higher in AI search' },
  { key: 'coupons', label: 'Promo codes', claim: 'quiet days filled with a promo code', detail: 'discount codes with a usage limit and an expiry date, as a percentage or a fixed amount' },
  { key: 'loyalty', label: 'Loyalty points', claim: 'regulars rewarded automatically', detail: 'customers collect points with every booking and spend them on the next one' },
  { key: 'packages', label: 'Packages', claim: 'packages sold, not just single visits', detail: 'several services or sessions bundled at one price and booked in a few taps', not: ['hospitality'] },
  { key: 'extras', label: 'Add-ons', claim: 'more earned from every booking', detail: 'customers add extras to their booking while they book' },
  { key: 'customers', label: 'Customer history', claim: 'every customer remembered', detail: 'each customer has a profile with their past visits and bookings' },
  { key: 'analytics', label: 'Numbers at a glance', claim: 'a clear view of what the business earns', detail: 'bookings, revenue and the most popular services in one dashboard' },
  { key: 'phone', label: 'Run it from the phone', claim: 'the whole day run from the phone', detail: 'new bookings, approvals and the calendar are in the Balkina app' },
  { key: 'tables', label: 'Table requests', claim: 'table requests without phone calls', detail: 'guests choose the time and the number of guests, and the venue confirms the request with one tap', only: ['hospitality'] },
  { key: 'events', label: 'Seats for events', claim: 'seats sold for brunches, tastings and special evenings', detail: 'an event has seatings with a set number of seats and a price per guest, and guests reserve their seats themselves', only: ['hospitality', 'events', 'food'] },
];

export const opportunityByKey = (key?: string | null): Opportunity | undefined => OPPORTUNITIES.find((o) => o.key === key);

/** Ideas that make sense for an audience's category. */
export const opportunitiesFor = (category: string): Opportunity[] =>
  OPPORTUNITIES.filter((o) => (!o.only || o.only.includes(category)) && !o.not?.includes(category));

/**
 * The idea for the next post: one that has not been used yet (at random), otherwise the one used longest ago.
 * `recent` lists the ideas of the latest posts, newest first; `exclude` is never picked (the idea being replaced).
 */
export function pickOpportunity(category: string, recent: string[], exclude?: string | null): Opportunity {
  const pool = opportunitiesFor(category).filter((o) => o.key !== exclude);
  const unused = pool.filter((o) => !recent.includes(o.key));
  if (unused.length) return unused[Math.floor(Math.random() * unused.length)]!;
  return [...pool].sort((a, b) => recent.indexOf(b.key) - recent.indexOf(a.key))[0] ?? OPPORTUNITIES[0]!;
}

/** Finished posts as a bar for voice and length (the copywriter never sees the one for its own idea or audience). */
export const EXAMPLES: { vertical: string; idea: string; en: [string, string]; sr: [string, string] }[] = [
  { vertical: 'salon', idea: 'ai_discovery', en: ['Let clients find and book you with AI.', 'They ask the Balkina app for a cut, it books your free slot.'], sr: ['Neka vas klijentkinje nađu uz AI.', 'Pitaju Balkina aplikaciju za šišanje, a ona zakaže kod vas.'] },
  { vertical: 'barber', idea: 'reminders', en: ['Fewer empty chairs on Saturday.', 'Every customer gets a reminder the day before.'], sr: ['Manje praznih stolica subotom.', 'Svaka mušterija dobija podsjetnik dan ranije.'] },
  { vertical: 'restaurant', idea: 'tables', en: ['Table requests, without the phone.', 'Guests pick the time. You confirm with a tap.'], sr: ['Rezervacije stolova bez telefona.', 'Gosti biraju vrijeme. Vi potvrdite dodirom.'] },
  { vertical: 'pilates', idea: 'rebooking', en: ['AI brings your regulars back.', 'Each client gets a nudge when the next class is due.'], sr: ['AI vraća vaše stalne klijente.', 'Svaki klijent dobija podsjetnik za novi čas.'] },
  { vertical: 'tires', idea: 'coupons', en: ['Fill the quiet weeks with a code.', 'A promo code with a limit and an end date, ready in a minute.'], sr: ['Popunite mirne sedmice promo kodom.', 'Kod sa limitom i rokom trajanja, gotov za minut.'] },
];
