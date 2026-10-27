/* Instagram studio catalogue: the 12 top-level business categories (same taxonomy as `categories`
   where parent_id is null) each have their own Canva template pair, and every audience (vertical)
   belongs to one category. The eyebrow on the image is the category name, not written by the LLM. */

export type Lang = 'sr' | 'en';

export interface StudioCategory {
  key: string;        // template layout word: "IG · 02 beauty · square"
  order: number;      // the NN in the template name
  slug: string;       // categories.slug
  name: Record<Lang, string>;   // eyebrow text (upper-cased on the image)
}

export const CATEGORIES: StudioCategory[] = [
  { key: 'health', order: 1, slug: 'health-wellness', name: { en: 'Health & Wellness', sr: 'Zdravlje i wellness' } },
  { key: 'beauty', order: 2, slug: 'beauty-personal-care', name: { en: 'Beauty & Personal Care', sr: 'Lepota i nega' } },
  { key: 'fitness', order: 3, slug: 'fitness-sports', name: { en: 'Fitness & Sports', sr: 'Fitnes i sport' } },
  { key: 'home', order: 4, slug: 'home-services', name: { en: 'Home Services', sr: 'Usluge za dom' } },
  { key: 'professional', order: 5, slug: 'professional-services', name: { en: 'Professional Services', sr: 'Profesionalne usluge' } },
  { key: 'education', order: 6, slug: 'education-tutoring', name: { en: 'Education & Tutoring', sr: 'Edukacija i časovi' } },
  { key: 'pets', order: 7, slug: 'pet-services', name: { en: 'Pet Services', sr: 'Usluge za ljubimce' } },
  { key: 'auto', order: 8, slug: 'automotive', name: { en: 'Automotive', sr: 'Auto usluge' } },
  { key: 'events', order: 9, slug: 'events-entertainment', name: { en: 'Events & Entertainment', sr: 'Događaji i zabava' } },
  { key: 'food', order: 10, slug: 'food-nutrition', name: { en: 'Food & Nutrition', sr: 'Hrana i ishrana' } },
  { key: 'rentals', order: 11, slug: 'rentals-tours', name: { en: 'Rentals & Tours', sr: 'Iznajmljivanje i ture' } },
  { key: 'hospitality', order: 12, slug: 'hospitality', name: { en: 'Hospitality', sr: 'Ugostiteljstvo' } },
];

export const categoryByKey = (key: string): StudioCategory | undefined => CATEGORIES.find((c) => c.key === key);

export interface StudioVertical {
  value: string;
  label: string;        // English, for the admin UI
  sr: string;           // how the copywriter names the audience in Serbian
  category: string;     // CATEGORIES.key
  photo: string[];      // words that pick a library photo for this audience
}

/** Audiences the studio can write for, grouped by category. The first of each category is its default. */
export const VERTICALS: StudioVertical[] = [
  // health
  { value: 'massage', label: 'Massage therapist', sr: 'maser', category: 'health', photo: ['massage', 'spa'] },
  { value: 'physio', label: 'Physiotherapist', sr: 'fizioterapeut', category: 'health', photo: ['physio', 'therapy'] },
  { value: 'yoga', label: 'Yoga studio', sr: 'joga studio', category: 'health', photo: ['yoga'] },
  { value: 'pilates', label: 'Pilates', sr: 'pilates studio', category: 'health', photo: ['pilates', 'reformer'] },
  { value: 'counseling', label: 'Counselling & therapy', sr: 'psihoterapeut', category: 'health', photo: ['counsel', 'therapy'] },
  // beauty
  { value: 'salon', label: 'Hair salon', sr: 'frizerski salon', category: 'beauty', photo: ['salon', 'hair'] },
  { value: 'barber', label: 'Barbershop', sr: 'barbershop', category: 'beauty', photo: ['barber', 'beard', 'shave'] },
  { value: 'nails', label: 'Nail studio', sr: 'nail studio', category: 'beauty', photo: ['nail', 'manic'] },
  { value: 'lashes', label: 'Lashes & brows', sr: 'trepavice i obrve', category: 'beauty', photo: ['lash', 'brow'] },
  { value: 'makeup', label: 'Makeup artist', sr: 'šminker', category: 'beauty', photo: ['makeup', 'mua'] },
  { value: 'spa', label: 'Spa', sr: 'spa centar', category: 'beauty', photo: ['spa', 'facial'] },
  { value: 'skincare', label: 'Skincare clinic', sr: 'kozmetički salon', category: 'beauty', photo: ['facial', 'skin'] },
  { value: 'beauty', label: 'Beauty salon', sr: 'salon lepote', category: 'beauty', photo: ['beauty', 'salon'] },
  // fitness
  { value: 'fitness', label: 'Personal trainer', sr: 'personalni trener', category: 'fitness', photo: ['fit', 'gym', 'train'] },
  { value: 'gym', label: 'Gym', sr: 'teretana', category: 'fitness', photo: ['gym'] },
  { value: 'tennis', label: 'Tennis coach', sr: 'teniski trener', category: 'fitness', photo: ['tennis'] },
  { value: 'dance', label: 'Dance studio', sr: 'plesni studio', category: 'fitness', photo: ['dance'] },
  { value: 'martial', label: 'Martial arts', sr: 'borilačke veštine', category: 'fitness', photo: ['martial', 'boxing'] },
  // home
  { value: 'cleaning', label: 'Cleaning service', sr: 'servis za čišćenje', category: 'home', photo: ['clean'] },
  { value: 'handyman', label: 'Handyman', sr: 'majstor', category: 'home', photo: ['handyman', 'repair'] },
  { value: 'plumber', label: 'Plumber', sr: 'vodoinstalater', category: 'home', photo: ['plumb'] },
  { value: 'electrician', label: 'Electrician', sr: 'električar', category: 'home', photo: ['electric'] },
  // professional
  { value: 'lawyer', label: 'Law firm', sr: 'advokatska kancelarija', category: 'professional', photo: ['law', 'legal'] },
  { value: 'accounting', label: 'Accountant', sr: 'knjigovođa', category: 'professional', photo: ['account', 'office'] },
  { value: 'photographer', label: 'Photographer', sr: 'fotograf', category: 'professional', photo: ['photo', 'camera'] },
  { value: 'realestate', label: 'Real estate agent', sr: 'agent za nekretnine', category: 'professional', photo: ['estate', 'apartment'] },
  // education
  { value: 'tutor', label: 'Tutor', sr: 'privatni profesor', category: 'education', photo: ['tutor', 'lesson'] },
  { value: 'language', label: 'Language school', sr: 'škola jezika', category: 'education', photo: ['language', 'class'] },
  { value: 'music', label: 'Music lessons', sr: 'časovi muzike', category: 'education', photo: ['music', 'piano', 'guitar'] },
  { value: 'driving', label: 'Driving school', sr: 'auto škola', category: 'education', photo: ['driving'] },
  { value: 'swimming', label: 'Swimming coach', sr: 'trener plivanja', category: 'education', photo: ['swim'] },
  // pets
  { value: 'grooming', label: 'Dog grooming', sr: 'salon za pse', category: 'pets', photo: ['groom', 'dog'] },
  { value: 'vet', label: 'Veterinary clinic', sr: 'veterinarska ambulanta', category: 'pets', photo: ['vet', 'pet'] },
  { value: 'dogtraining', label: 'Dog training', sr: 'dresura pasa', category: 'pets', photo: ['dog'] },
  // auto
  { value: 'autorepair', label: 'Auto repair', sr: 'auto servis', category: 'auto', photo: ['auto', 'mechanic', 'car'] },
  { value: 'carwash', label: 'Car wash', sr: 'autoperionica', category: 'auto', photo: ['wash', 'car'] },
  { value: 'tires', label: 'Tire shop', sr: 'vulkanizer', category: 'auto', photo: ['tire', 'car'] },
  // events
  { value: 'eventplanner', label: 'Event planner', sr: 'organizator događaja', category: 'events', photo: ['event', 'wedding'] },
  { value: 'dj', label: 'DJ', sr: 'DJ', category: 'events', photo: ['dj', 'party'] },
  { value: 'catering', label: 'Catering', sr: 'ketering', category: 'events', photo: ['cater', 'food'] },
  // food
  { value: 'dietitian', label: 'Dietitian', sr: 'nutricionista', category: 'food', photo: ['diet', 'nutrition'] },
  { value: 'mealprep', label: 'Meal prep', sr: 'priprema obroka', category: 'food', photo: ['meal', 'food'] },
  { value: 'chef', label: 'Personal chef', sr: 'privatni kuvar', category: 'food', photo: ['chef', 'cook'] },
  // rentals
  { value: 'boat', label: 'Boat tours', sr: 'izleti brodom', category: 'rentals', photo: ['boat', 'sea'] },
  { value: 'tours', label: 'Tour guide', sr: 'turistički vodič', category: 'rentals', photo: ['tour', 'guide'] },
  { value: 'rental', label: 'Equipment rental', sr: 'iznajmljivanje opreme', category: 'rentals', photo: ['rental', 'bike', 'scooter'] },
  // hospitality
  { value: 'restaurant', label: 'Restaurant', sr: 'restoran', category: 'hospitality', photo: ['restaurant', 'dining'] },
  { value: 'cafe', label: 'Café / bar', sr: 'kafić', category: 'hospitality', photo: ['cafe', 'coffee', 'bar'] },
  { value: 'hotel', label: 'Hotel / resort', sr: 'hotel', category: 'hospitality', photo: ['hotel', 'resort'] },
  // generic
  { value: 'all', label: 'All businesses', sr: 'mali biznisi', category: 'beauty', photo: [] },
];

export const verticalByValue = (value: string): StudioVertical | undefined => VERTICALS.find((v) => v.value === value);

/** Template layout word for an audience: its category key. */
export const categoryOf = (vertical: string): string => verticalByValue(vertical)?.category ?? 'beauty';

/** Eyebrow text for a category in a language, as it appears on the image. */
export function eyebrowFor(categoryKey: string, lang: Lang): string {
  const c = categoryByKey(categoryKey);
  return (c?.name[lang] ?? categoryKey).toUpperCase();
}

const HASHTAGS: Record<string, string[]> = {
  health: ['#wellness', '#zdravlje', '#masaza', '#fizioterapija'],
  beauty: ['#salonlepote', '#frizerskisalon', '#beautysalon', '#lepota'],
  fitness: ['#fitnes', '#trening', '#teretana', '#personaltrainer'],
  home: ['#ciscenje', '#majstor', '#uslugezadom', '#homeservices'],
  professional: ['#advokat', '#knjigovodstvo', '#fotograf', '#usluge'],
  education: ['#casovi', '#skolajezika', '#edukacija', '#tutoring'],
  pets: ['#ljubimci', '#psi', '#veterinar', '#petgrooming'],
  auto: ['#autoservis', '#autoperionica', '#vulkanizer', '#auto'],
  events: ['#dogadjaji', '#vencanje', '#eventplanner', '#dj'],
  food: ['#ishrana', '#nutricionista', '#zdravahrana', '#mealprep'],
  rentals: ['#izleti', '#boattour', '#turizam', '#crnagoraturizam'],
  hospitality: ['#restoran', '#kafic', '#rezervacija', '#hotel'],
};
const VERTICAL_TAGS: Record<string, string[]> = {
  salon: ['#frizer', '#hairsalon'], barber: ['#barbershop', '#brada'], nails: ['#nokti', '#manikir'], lashes: ['#trepavice', '#obrve'],
  makeup: ['#sminka', '#mua'], spa: ['#spa', '#relax'], yoga: ['#joga', '#yoga'], pilates: ['#pilates', '#reformer'], tennis: ['#tenis', '#tennis'],
  restaurant: ['#restoran', '#hrana'], cafe: ['#kafa', '#coffee'],
};
const BRAND_TAGS = ['#zakazivanje', '#onlinezakazivanje', '#balkina', '#booking'];
const PLACE_TAGS = ['#crnagora', '#podgorica', '#budva', '#bar', '#beograd', '#novisad'];

/** 8–10 hashtags: the audience's own, its category's, the brand tags, and two rotating place tags. */
export function studioHashtags(vertical: string, seed: number): string[] {
  const cat = categoryOf(vertical);
  const places = [PLACE_TAGS[seed % PLACE_TAGS.length], PLACE_TAGS[(seed + 3) % PLACE_TAGS.length]].filter((t): t is string => Boolean(t));
  return Array.from(new Set([...(VERTICAL_TAGS[vertical] ?? []), ...(HASHTAGS[cat] ?? []), ...BRAND_TAGS, ...places])).slice(0, 10);
}
