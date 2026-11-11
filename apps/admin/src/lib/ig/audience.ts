/* What the studio copywriter knows about each audience: who books with them, what gets booked, and the
   moments of their working day where booking hurts. A post is built on ONE of those moments (an "angle")
   so the copy speaks to that trade instead of to "businesses" in general. Scenes are written in English
   (the model localises them); `ask` and `words` are Montenegrin, as the owner hears them every day. */
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

/** One idea per post: the scene the hook is built on and the single product fact that answers it. */
export interface Angle {
  key: string;
  /** Which part of the profile carries the hook. */
  scene: 'busy' | 'when' | 'noshow' | 'ask' | 'books';
  /** What the headline does. */
  hook: string;
  /** The one product fact the subline lands on. */
  fact: string;
}

export const ANGLES: Angle[] = [
  { key: 'calls', scene: 'busy', hook: 'put the owner in that moment: hands busy, phone ringing, a booking about to be lost', fact: 'bookings come in online while they work, and the owner only gets a notification on the phone' },
  { key: 'afterhours', scene: 'when', hook: 'show the customer wanting to book at that moment, when nobody answers', fact: 'the booking page is open 24/7 and a booking takes 20 seconds' },
  { key: 'noshow', scene: 'noshow', hook: 'name that exact loss', fact: 'an SMS confirmation right away and an SMS reminder the day before, so people show up' },
  { key: 'link', scene: 'ask', hook: 'quote or echo that message they answer ten times a day', fact: 'one link in the Instagram bio, on the Google profile and on WhatsApp answers it, and the customer picks the time alone' },
  { key: 'free', scene: 'books', hook: 'promise that exact thing booked online, starting today', fact: 'the page is free, needs no card and is ready in about 10 seconds' },
];

export const angleByKey = (key?: string): Angle | undefined => ANGLES.find((a) => a.key === key);

/** Finished lines for other trades, as a bar for specificity (never reused: the copywriter gets only the ones for other audiences). */
export const EXAMPLES: { vertical: string; angle: string; en: [string, string]; sr: [string, string] }[] = [
  { vertical: 'barber', angle: 'calls', en: ['Mid-fade. Phone ringing.', 'Customers book online. You keep cutting.'], sr: ['Usred fejda. Telefon zvoni.', 'Mušterije zakazuju online. Vi šišate.'] },
  { vertical: 'restaurant', angle: 'noshow', en: ['Table for six. Nobody came.', 'An SMS reminder the day before fixes that.'], sr: ['Sto za šest. Niko nije došao.', 'SMS podsjetnik dan ranije to rješava.'] },
  { vertical: 'pilates', angle: 'afterhours', en: ['She wants a reformer at 11 pm.', 'Your booking page is open while you sleep.'], sr: ['Želi reformer u 23h.', 'Vaša stranica prima termine dok spavate.'] },
  { vertical: 'tires', angle: 'link', en: ['"When can I change my tyres?"', 'One link in your bio. They pick the slot.'], sr: ['„Kad mogu da zamijenim gume?“', 'Jedan link u biu. Sami biraju termin.'] },
];
