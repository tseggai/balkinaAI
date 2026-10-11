/**
 * Growth engine catalogues: supported countries/cities and business types
 * (verticals) with local-language search terms and default services.
 * Used by the admin "Generate prospects" flow and the pre-provisioner.
 */

export type GrowthLang = 'sr' | 'hr' | 'en';

export interface GrowthCountry {
  code: string; // ISO 3166-1 alpha-2, lower case
  name: string;
  language: GrowthLang;
  currency: string;
  timezone: string;
  cities: string[];
}

export const GROWTH_COUNTRIES: GrowthCountry[] = [
  { code: 'rs', name: 'Serbia', language: 'sr', currency: 'RSD', timezone: 'Europe/Belgrade', cities: ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Zrenjanin', 'Pančevo', 'Čačak', 'Novi Pazar', 'Kraljevo'] },
  { code: 'me', name: 'Montenegro', language: 'sr', currency: 'EUR', timezone: 'Europe/Podgorica', cities: ['Podgorica', 'Budva', 'Kotor', 'Tivat', 'Herceg Novi', 'Bar', 'Nikšić', 'Ulcinj', 'Cetinje'] },
  { code: 'hr', name: 'Croatia', language: 'hr', currency: 'EUR', timezone: 'Europe/Zagreb', cities: ['Zagreb', 'Split', 'Dubrovnik', 'Zadar', 'Rijeka', 'Pula', 'Šibenik', 'Osijek', 'Makarska', 'Rovinj'] },
  { code: 'ba', name: 'Bosnia and Herzegovina', language: 'sr', currency: 'BAM', timezone: 'Europe/Sarajevo', cities: ['Sarajevo', 'Banja Luka', 'Mostar', 'Tuzla', 'Zenica'] },
  { code: 'mk', name: 'North Macedonia', language: 'en', currency: 'MKD', timezone: 'Europe/Skopje', cities: ['Skopje', 'Ohrid', 'Bitola'] },
  { code: 'si', name: 'Slovenia', language: 'hr', currency: 'EUR', timezone: 'Europe/Ljubljana', cities: ['Ljubljana', 'Maribor', 'Koper', 'Bled'] },
  { code: 'al', name: 'Albania', language: 'en', currency: 'ALL', timezone: 'Europe/Tirane', cities: ['Tirana', 'Durrës', 'Vlorë', 'Sarandë'] },
];

export interface GrowthDefaultService {
  name: Record<GrowthLang, string>;
  duration_minutes: number;
}

export interface GrowthVertical {
  key: string;
  label: string;
  /** Places text query per language. */
  query: Record<GrowthLang, string>;
  /** categories.slug to link the pre-provisioned tenant to. */
  category_slug: string;
  business_type: 'service' | 'hospitality';
  tier: 1 | 2 | 3;
  default_services: GrowthDefaultService[];
}

const svc = (sr: string, hr: string, en: string, duration_minutes: number): GrowthDefaultService => ({
  name: { sr, hr, en },
  duration_minutes,
});

export const GROWTH_VERTICALS: GrowthVertical[] = [
  {
    key: 'hair_salon', label: 'Hair salon', tier: 1, category_slug: 'hair-salon', business_type: 'service',
    query: { sr: 'frizerski salon', hr: 'frizerski salon', en: 'hair salon' },
    default_services: [svc('Žensko šišanje', 'Žensko šišanje', "Women's haircut", 45), svc('Muško šišanje', 'Muško šišanje', "Men's haircut", 30), svc('Farbanje', 'Bojanje kose', 'Hair colouring', 90), svc('Feniranje', 'Feniranje', 'Blow-dry', 30)],
  },
  {
    key: 'barber', label: 'Barbershop', tier: 1, category_slug: 'barbershop', business_type: 'service',
    query: { sr: 'barber shop', hr: 'brijačnica barber', en: 'barber shop' },
    default_services: [svc('Šišanje', 'Šišanje', 'Haircut', 30), svc('Brada', 'Brada', 'Beard trim', 20), svc('Šišanje + brada', 'Šišanje + brada', 'Haircut + beard', 45)],
  },
  {
    key: 'nail_studio', label: 'Nail studio', tier: 1, category_slug: 'nail-studio', business_type: 'service',
    query: { sr: 'nail studio manikir', hr: 'manikura nail studio', en: 'nail salon' },
    default_services: [svc('Manikir', 'Manikura', 'Manicure', 45), svc('Gel lak', 'Gel lak', 'Gel polish', 60), svc('Pedikir', 'Pedikura', 'Pedicure', 60)],
  },
  {
    key: 'lash_brow', label: 'Lash & brow studio', tier: 2, category_slug: 'lash-brow-studio', business_type: 'service',
    query: { sr: 'lash studio trepavice', hr: 'trepavice lash studio', en: 'lash studio' },
    default_services: [svc('Nadogradnja trepavica', 'Nadogradnja trepavica', 'Lash extensions', 90), svc('Laminacija obrva', 'Laminacija obrva', 'Brow lamination', 45)],
  },
  {
    key: 'beauty_clinic', label: 'Beauty / skincare', tier: 2, category_slug: 'skincare-clinic', business_type: 'service',
    query: { sr: 'kozmetički salon', hr: 'kozmetički salon', en: 'beauty salon' },
    default_services: [svc('Tretman lica', 'Tretman lica', 'Facial', 60), svc('Depilacija', 'Depilacija', 'Waxing', 30)],
  },
  {
    key: 'massage', label: 'Massage', tier: 2, category_slug: 'massage-therapy', business_type: 'service',
    query: { sr: 'masaža', hr: 'masaža', en: 'massage' },
    default_services: [svc('Relax masaža 60 min', 'Relax masaža 60 min', 'Relaxing massage 60 min', 60), svc('Terapeutska masaža', 'Terapeutska masaža', 'Therapeutic massage', 45)],
  },
  {
    key: 'spa', label: 'Spa', tier: 3, category_slug: 'spa', business_type: 'service',
    query: { sr: 'spa centar', hr: 'spa centar', en: 'spa' },
    default_services: [svc('Spa paket', 'Spa paket', 'Spa package', 90), svc('Masaža', 'Masaža', 'Massage', 60)],
  },
  {
    key: 'physio', label: 'Physiotherapy', tier: 2, category_slug: 'physical-therapy', business_type: 'service',
    query: { sr: 'fizioterapija', hr: 'fizioterapija', en: 'physiotherapy' },
    default_services: [svc('Fizioterapijski tretman', 'Fizioterapijski tretman', 'Physiotherapy session', 45), svc('Prvi pregled', 'Prvi pregled', 'Initial assessment', 60)],
  },
  {
    key: 'dentist', label: 'Dentist', tier: 3, category_slug: 'health-wellness', business_type: 'service',
    query: { sr: 'stomatolog', hr: 'stomatolog zubar', en: 'dentist' },
    default_services: [svc('Pregled', 'Pregled', 'Check-up', 30), svc('Čišćenje kamenca', 'Čišćenje zubnog kamenca', 'Dental cleaning', 45)],
  },
  {
    key: 'trainer', label: 'Personal trainer', tier: 3, category_slug: 'personal-trainer', business_type: 'service',
    query: { sr: 'personalni trener', hr: 'osobni trener', en: 'personal trainer' },
    default_services: [svc('Personalni trening', 'Osobni trening', 'Personal training session', 60)],
  },
  {
    key: 'yoga_pilates', label: 'Yoga / pilates', tier: 3, category_slug: 'yoga-meditation', business_type: 'service',
    query: { sr: 'joga pilates studio', hr: 'joga pilates studio', en: 'yoga pilates studio' },
    default_services: [svc('Grupni čas', 'Grupni sat', 'Group class', 60), svc('Privatni čas', 'Privatni sat', 'Private session', 60)],
  },
  {
    key: 'gym', label: 'Gym', tier: 3, category_slug: 'gym', business_type: 'service',
    query: { sr: 'teretana', hr: 'teretana', en: 'gym' },
    default_services: [svc('Personalni trening', 'Osobni trening', 'Personal training', 60)],
  },
  {
    key: 'tour_operator', label: 'Tours & excursions', tier: 2, category_slug: 'tour-guide', business_type: 'service',
    query: { sr: 'izleti ture turistička agencija', hr: 'izleti ture turistička agencija', en: 'tours excursions' },
    default_services: [svc('Celodnevni izlet', 'Cjelodnevni izlet', 'Full-day tour', 480), svc('Poludnevni izlet', 'Poludnevni izlet', 'Half-day tour', 240)],
  },
  {
    key: 'boat_tour', label: 'Boat tours', tier: 2, category_slug: 'boat-charter', business_type: 'service',
    query: { sr: 'boat tour', hr: 'izlet brodom boat tour', en: 'boat tour' },
    default_services: [svc('Vožnja brodom', 'Izlet brodom', 'Boat trip', 180), svc('Privatni čarter', 'Privatni čarter', 'Private charter', 480)],
  },
  {
    key: 'restaurant', label: 'Restaurant', tier: 3, category_slug: 'restaurant', business_type: 'hospitality',
    query: { sr: 'restoran', hr: 'restoran', en: 'restaurant' },
    default_services: [svc('Rezervacija stola', 'Rezervacija stola', 'Table reservation', 90)],
  },
  {
    key: 'cafe', label: 'Café / bar', tier: 3, category_slug: 'cafe-bar', business_type: 'hospitality',
    query: { sr: 'kafić', hr: 'kafić', en: 'cafe bar' },
    default_services: [svc('Rezervacija stola', 'Rezervacija stola', 'Table reservation', 90)],
  },
];

export function getGrowthCountry(code: string | null | undefined): GrowthCountry | undefined {
  return GROWTH_COUNTRIES.find((c) => c.code === (code ?? '').toLowerCase());
}

export function getGrowthVertical(key: string | null | undefined): GrowthVertical | undefined {
  return GROWTH_VERTICALS.find((v) => v.key === key);
}
