import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// Sample business data for generating realistic test tenants.
// Keyed by the "biz type" bucket used for image/service pools below.
// Multiple category slugs can map to the same bucket (see CATEGORY_SLUG_TO_BIZTYPE).
const BUSINESS_TYPES: Record<string, { names: string[]; category: string }> = {
  barbershop: {
    names: [
      'Elite Cuts', 'Sharp Edge Barbers', "The Gentleman's Den", 'Crown Barbershop', 'Fade Factory',
      'Clean Cut Barbers', 'Urban Edge Barbers', 'Classic Mane Barbers', 'Barber & Blade',
    ],
    category: 'barbershop',
  },
  beauty: {
    names: [
      'Glow Beauty Studio', 'Serenity Spa & Salon', 'Luxe Hair Lounge', 'Bella Nails & Spa', 'Radiance Beauty Bar',
      'Velvet Salon', 'Lush Lash Lounge', 'Arch Brow Bar', 'Chroma Color Studio', 'The Blowout Bar',
      'Primped & Polished', 'Mirror Mirror Salon', 'Rose Gold Salon', 'Studio Noir', 'Bombshell Beauty',
    ],
    category: 'beauty',
  },
  wellness: {
    names: [
      'Zen Wellness Center', 'Pure Massage Therapy', 'Harmony Day Spa', 'Bliss Body Works', 'Tranquil Touch',
      'Vitality Holistic Care', 'Mindful Path Therapy', 'Balance Chiropractic', 'Serenity Acupuncture',
      'Whole Body Wellness', 'Inner Peace Therapy', 'Healing Hands Wellness', 'Rejuvenate Health',
      'Elevate Wellness', 'True North Wellness',
    ],
    category: 'wellness',
  },
  fitness: {
    names: [
      'FitPro Personal Training', 'Iron Body Gym', 'Peak Performance Studio', 'Core Strength Fitness', 'Agile Athletics',
      'Kinetic Movement Studio', 'Pulse Fitness Club', 'Summit Training Center', 'The Grind Gym', 'Flex Fitness Studio',
      'Thrive Yoga Studio', 'Empower Pilates', 'Warrior Martial Arts', 'Apex Training Academy', 'Evolve Fitness',
    ],
    category: 'fitness',
  },
  medical: {
    names: [
      'Dr. Smith Dental', 'Bright Smile Clinic', 'ClearView Optometry', 'Premier Dermatology', 'HealthFirst Medical',
      'Prime Care Clinic', 'Wellness Medical Group', 'Sunrise Family Practice', 'MedFirst Clinic', 'Vital Care Medical',
    ],
    category: 'medical',
  },
  home_services: {
    names: [
      'Sparkle Clean Co', 'Pristine Home Services', 'TrueBlue Plumbing', 'Bright Spark Electric', 'Green Thumb Landscaping',
      'Handyman Heroes', 'Spotless Cleaning Crew', 'Reliable Home Repairs', 'Cutting Edge Lawn Care', 'Perfect Paint Pros',
      'Superior HVAC', 'ProFix Plumbing', 'Volt Electric Services', 'Master Handyman', 'Crystal Clear Windows',
      'Home Harmony Cleaning', 'EverGreen Landscapes', 'Top Notch Home Services', 'Ace Pest Control', 'Fresh Air HVAC',
    ],
    category: 'home_services',
  },
  professional: {
    names: [
      'Pinnacle Legal Group', 'Summit Accounting', 'Bright Future Financial', 'Keystone Consulting', 'Harbor Tax Services',
      'Everest Law Firm', 'Clear Path Advisors', 'Meridian Consulting Group', 'Cornerstone CPA', 'Blue Ocean Advisors',
      'Atlas Accounting', 'Beacon Financial Planning', 'North Star Consulting', 'Sterling Tax Advisors', 'Legacy Law Partners',
      'Strategic Edge Consulting', 'Capstone Financial', 'Lighthouse Legal', 'Evergreen Wealth Management', 'Silverline Consulting',
    ],
    category: 'professional',
  },
  education: {
    names: [
      'Bright Minds Tutoring', "Scholar's Edge Academy", 'Einstein Learning Center', 'Phoenix Prep', 'Mosaic Music School',
      'Crescendo Music Studio', 'Polyglot Language Academy', 'Ace Drive School', 'BookSmart Tutors', 'Creative Minds Art Studio',
      'Harmonix Music Lessons', 'Lingua Franca School', 'Gear Up Driving School', 'Rising Star Academy', 'Maestro Music Academy',
      'Beacon Learning Lab', 'Prodigy Tutors', 'Quest Academic Center', 'Palette Art School', 'Sharp Drive Academy',
    ],
    category: 'education',
  },
  pet: {
    names: [
      'Pawsitive Grooming', 'Happy Tails Pet Spa', 'Furry Friends Care', 'The Pampered Pup', 'Whiskers & Wags',
      'Bark Ave Pet Care', 'Snuggle Buddies Boarding', 'Pet Paradise Grooming', 'Cuddle Club Boarding', 'Wagging Tails Daycare',
      'Tail Waggers Training', 'Zen Den Pet Grooming', 'Pawprints Pet Services', 'The Pet Stylist', 'Noble Paws Training',
      'Top Dog Training Academy', 'Sit Stay Play Daycare', 'Pooch Palace', 'The Dapper Dog', "Fido's Finest",
    ],
    category: 'pet',
  },
  automotive: {
    names: [
      'Apex Auto Repair', 'Precision Automotive', 'Turbocharged Service Center', 'Shine On Car Wash', 'Redline Mechanics',
      'Speed Shop Auto', 'Gearhead Garage', 'Pitstop Tire & Lube', 'Chrome City Detail', 'Elite Auto Body',
      'Grease Monkey Garage', 'Detail Pros', 'Summit Automotive', 'High Gear Repair', 'Auto Doctors',
      'Motorworks Garage', 'Pro Wheel Alignment', 'Tire Titans', 'Ignition Auto Service', 'Lube Stop Pro',
    ],
    category: 'automotive',
  },
  events: {
    names: [
      'Starlight Events Co', 'Celebration Station', 'Moments Captured Photo', 'DJ BeatMasters', 'Elite Event Planners',
      'Golden Hour Photography', 'Bash Event Planning', 'Crescendo Entertainment', 'Signature Events', 'Frame Perfect Photography',
      'Vibe DJ Services', 'Limelight Entertainment', 'Grand Celebration Planners', 'Picture Perfect Studios', 'The Party Architects',
      'Lavish Events', 'Focal Point Photo', 'Artisan Photography', 'Pulse Events DJ', 'Marquee Events',
    ],
    category: 'events',
  },
  food: {
    names: [
      'NourishWell Nutrition', 'Fresh Fuel Dietitian', 'Balanced Bites Coaching', 'Whole Plate Nutrition', 'Vital Greens Wellness',
      'SmartEats Nutrition', 'Pure Plate Coaching', 'Healthy Habits Clinic', 'Greenleaf Nutrition', 'Nutri Wise Coaching',
      'Clean Kitchen Cooking Class', "The Chef's Table", 'Fork & Spoon Cooking', 'Kitchen Academy', 'Well Fed Nutrition',
      'Plant Power Coaching', 'Mindful Meals Coaching', 'Wholesome Table', 'Simply Nourished', 'Savor Cooking School',
    ],
    category: 'food',
  },
  rentals: {
    names: [
      'Coastal Kayak Rentals', 'Adventure Bike Rentals', 'Blue Wave Boat Charters', 'City Cruiser Tours', 'Alpine Ski Rentals',
      'Summit Gear Rentals', 'Sunset Sail Charters', 'Ride On Bike Rentals', 'Wanderlust Tours', 'Anchor Boat Rentals',
      'Highland Tour Co', 'Mountain View Tours', 'Nautical Adventures', 'The Tour Guides', 'Urban Explorer Tours',
      'Blue Horizon Charters', 'Coastline Tours', 'Breeze Sailing Charters', 'Sunrise Sailing Co', 'Harbor Tours',
    ],
    category: 'rentals',
  },
};

// Map category slug (from the categories table) -> biz type key in BUSINESS_TYPES.
// This replaces the old fuzzy name matching, which only worked for 5 categories.
const CATEGORY_SLUG_TO_BIZTYPE: Record<string, string> = {
  'health-wellness': 'wellness',
  'beauty-personal-care': 'beauty',
  'fitness-sports': 'fitness',
  'home-services': 'home_services',
  'professional-services': 'professional',
  'education-tutoring': 'education',
  'pet-services': 'pet',
  'automotive': 'automotive',
  'events-entertainment': 'events',
  'food-nutrition': 'food',
  'rentals-tours': 'rentals',
};

const FIRST_NAMES = ['James', 'Maria', 'David', 'Sarah', 'Michael', 'Emma', 'Robert', 'Lisa', 'Carlos', 'Fatima', 'Ahmed', 'Yuki', 'Olga', 'Chen', 'Priya'];
const LAST_NAMES = ['Johnson', 'Garcia', 'Williams', 'Martinez', 'Brown', 'Lee', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark'];

// Fallback cities used when no custom locations are provided
const DEFAULT_CITIES: LocationInput[] = [
  { name: 'San Francisco', state: 'CA', country: 'United States', lat: 37.7749, lng: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'New York', state: 'NY', country: 'United States', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  { name: 'Chicago', state: 'IL', country: 'United States', lat: 41.8781, lng: -87.6298, tz: 'America/Chicago' },
  { name: 'Miami', state: 'FL', country: 'United States', lat: 25.7617, lng: -80.1918, tz: 'America/New_York' },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
];

interface LocationInput {
  name: string;
  lat: number;
  lng: number;
  tz: string;
  address?: string;
  state?: string;
  country?: string;
}

// Geocode a city name to get lat/lng/timezone using Google Maps API
async function geocodeCity(city: string, country?: string): Promise<{ lat: number; lng: number; tz: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const query = country ? `${city}, ${country}` : city;
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const geoJson = await geoRes.json() as { status: string; results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    if (geoJson.status !== 'OK' || !geoJson.results?.[0]?.geometry?.location) return null;

    const { lat, lng } = geoJson.results[0].geometry.location;

    const tzRes = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`
    );
    const tzJson = await tzRes.json() as { status: string; timeZoneId?: string };
    const tz = tzJson.status === 'OK' && tzJson.timeZoneId ? tzJson.timeZoneId : 'UTC';

    return { lat, lng, tz };
  } catch {
    return null;
  }
}

const STAFF_NAMES = [
  'Alex Rivera', 'Jordan Smith', 'Taylor Kim', 'Morgan Lee', 'Casey Brown',
  'Riley Johnson', 'Avery Davis', 'Quinn Wilson', 'Reese Martinez', 'Dakota Thomas',
];

// Category-appropriate logo images (Unsplash, 400x400 crop).
// These pools are intentionally short — Chunk 3 adds uniqueness tracking and
// picsum fallback so we don't repeat within a single bulk run.
const LOGO_IMAGES: Record<string, string[]> = {
  barbershop: [
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1585747860830-63ab9dfd12f3?w=400&h=400&fit=crop',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1562322140-8baeececf08b?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=400&fit=crop',
  ],
  wellness: [
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=400&fit=crop',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=400&fit=crop',
  ],
  medical: [
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=400&fit=crop',
  ],
  home_services: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1594201843309-d3d69b4d85ce?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=400&fit=crop',
  ],
  professional: [
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop',
  ],
  education: [
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&h=400&fit=crop',
  ],
  pet: [
    'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1415369629372-26f2fe60c467?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=400&h=400&fit=crop',
  ],
  automotive: [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=400&fit=crop',
  ],
  events: [
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=400&fit=crop',
  ],
  food: [
    'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=400&fit=crop',
  ],
  rentals: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1502780402662-acc01917ba4c?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=400&h=400&fit=crop',
  ],
};

// Staff headshot images (Unsplash, 200x200 crop, face-focused)
const STAFF_IMAGES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',
];

// Service images per category (Unsplash, 400x200 crop)
const SERVICE_IMAGES: Record<string, string[]> = {
  barbershop: [
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=200&fit=crop',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400&h=200&fit=crop',
  ],
  wellness: [
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&h=200&fit=crop',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=200&fit=crop',
  ],
  medical: [
    'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=200&fit=crop',
  ],
  home_services: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1594201843309-d3d69b4d85ce?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=200&fit=crop',
  ],
  professional: [
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop',
  ],
  education: [
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=400&h=200&fit=crop',
  ],
  pet: [
    'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1415369629372-26f2fe60c467?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=400&h=200&fit=crop',
  ],
  automotive: [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=200&fit=crop',
  ],
  events: [
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=200&fit=crop',
  ],
  food: [
    'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=200&fit=crop',
  ],
  rentals: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1502780402662-acc01917ba4c?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=200&fit=crop',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=400&h=200&fit=crop',
  ],
};

// Gallery images per category (Unsplash, 1200x800 crop for full-screen display)
const GALLERY_IMAGES: Record<string, string[]> = {
  barbershop: [
    'https://images.unsplash.com/photo-1585747860830-63ab9dfd12f3?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&h=800&fit=crop',
  ],
  beauty: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=1200&h=800&fit=crop',
  ],
  wellness: [
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1200&h=800&fit=crop',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=1200&h=800&fit=crop',
  ],
  medical: [
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1200&h=800&fit=crop',
  ],
  home_services: [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1594201843309-d3d69b4d85ce?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop',
  ],
  professional: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&h=800&fit=crop',
  ],
  education: [
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=800&fit=crop',
  ],
  pet: [
    'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1415369629372-26f2fe60c467?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&h=800&fit=crop',
  ],
  automotive: [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?w=1200&h=800&fit=crop',
  ],
  events: [
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&h=800&fit=crop',
  ],
  food: [
    'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=1200&h=800&fit=crop',
  ],
  rentals: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1502780402662-acc01917ba4c?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=1200&h=800&fit=crop',
  ],
};

const SERVICE_TEMPLATES: Record<string, { name: string; price: number; duration: number }[]> = {
  barbershop: [
    { name: 'Haircut', price: 35, duration: 30 },
    { name: 'Beard Trim', price: 20, duration: 15 },
    { name: 'Hot Towel Shave', price: 40, duration: 30 },
    { name: 'Hair & Beard Combo', price: 50, duration: 45 },
  ],
  beauty: [
    { name: 'Manicure', price: 35, duration: 30 },
    { name: 'Pedicure', price: 45, duration: 45 },
    { name: 'Facial', price: 75, duration: 60 },
    { name: 'Hair Coloring', price: 120, duration: 90 },
  ],
  wellness: [
    { name: 'Swedish Massage', price: 90, duration: 60 },
    { name: 'Deep Tissue Massage', price: 110, duration: 60 },
    { name: 'Aromatherapy', price: 80, duration: 45 },
    { name: 'Hot Stone Therapy', price: 120, duration: 75 },
  ],
  fitness: [
    { name: 'Personal Training', price: 70, duration: 60 },
    { name: 'Group Class', price: 25, duration: 45 },
    { name: 'Yoga Session', price: 30, duration: 60 },
    { name: 'HIIT Workout', price: 35, duration: 30 },
  ],
  medical: [
    { name: 'Consultation', price: 150, duration: 30 },
    { name: 'Check-up', price: 200, duration: 45 },
    { name: 'Follow-up', price: 100, duration: 20 },
    { name: 'Treatment Session', price: 250, duration: 60 },
  ],
  home_services: [
    { name: 'Standard Cleaning', price: 120, duration: 120 },
    { name: 'Deep Cleaning', price: 220, duration: 180 },
    { name: 'Handyman Visit', price: 95, duration: 60 },
    { name: 'Plumbing Inspection', price: 85, duration: 45 },
  ],
  professional: [
    { name: 'Initial Consultation', price: 150, duration: 45 },
    { name: 'Tax Preparation', price: 250, duration: 60 },
    { name: 'Legal Review', price: 200, duration: 60 },
    { name: 'Financial Planning Session', price: 180, duration: 60 },
  ],
  education: [
    { name: 'Tutoring Session', price: 60, duration: 60 },
    { name: 'Music Lesson', price: 50, duration: 45 },
    { name: 'Language Class', price: 45, duration: 60 },
    { name: 'Test Prep Session', price: 75, duration: 90 },
  ],
  pet: [
    { name: 'Dog Grooming', price: 65, duration: 75 },
    { name: 'Cat Grooming', price: 55, duration: 60 },
    { name: 'Training Session', price: 80, duration: 60 },
    { name: 'Daycare Day', price: 40, duration: 480 },
  ],
  automotive: [
    { name: 'Oil Change', price: 55, duration: 30 },
    { name: 'Tire Rotation', price: 40, duration: 30 },
    { name: 'Full Detail', price: 180, duration: 150 },
    { name: 'Brake Service', price: 220, duration: 90 },
  ],
  events: [
    { name: 'Photography Session', price: 350, duration: 120 },
    { name: 'DJ Booking (per hour)', price: 150, duration: 60 },
    { name: 'Event Planning Consultation', price: 120, duration: 60 },
    { name: 'Videography Package', price: 500, duration: 180 },
  ],
  food: [
    { name: 'Nutrition Consultation', price: 120, duration: 60 },
    { name: 'Meal Planning Session', price: 90, duration: 45 },
    { name: 'Cooking Class', price: 75, duration: 90 },
    { name: 'Follow-up Session', price: 60, duration: 30 },
  ],
  rentals: [
    { name: 'Half-Day Rental', price: 60, duration: 240 },
    { name: 'Full-Day Rental', price: 110, duration: 480 },
    { name: 'Guided Tour', price: 95, duration: 180 },
    { name: 'Private Charter', price: 280, duration: 240 },
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const count = Math.min(50, Math.max(1, parseInt(body.count ?? '10', 10)));
  const withStaff = body.with_staff !== false;
  const withServices = body.with_services !== false;

  // Custom locations: array of { name, country? } (simplified) or { name, lat, lng, tz } (full)
  // If provided, ALL tenants get exactly these locations
  // If not provided, each tenant gets 1-3 random cities from defaults
  let customLocations: LocationInput[] | null = null;
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    // Resolve any locations missing lat/lng/tz via geocoding
    const resolved: LocationInput[] = [];
    for (const loc of body.locations as { name: string; country?: string; state?: string; lat?: number; lng?: number; tz?: string; address?: string }[]) {
      if (!loc.name) continue;
      if (loc.lat && loc.lng && loc.tz) {
        resolved.push(loc as LocationInput);
      } else {
        // Geocode from city + country
        const geo = await geocodeCity(loc.name, loc.country);
        if (geo) {
          resolved.push({
            name: loc.name,
            lat: geo.lat,
            lng: geo.lng,
            tz: geo.tz,
            country: loc.country,
            state: loc.state,
            address: loc.address,
          });
        } else {
          // Geocoding failed — still add but use default city coordinates
          // Look up from DEFAULT_CITIES if name matches
          const defaultCity = DEFAULT_CITIES.find(c => c.name.toLowerCase() === loc.name.toLowerCase());
          resolved.push({
            name: loc.name,
            lat: defaultCity?.lat ?? 0,
            lng: defaultCity?.lng ?? 0,
            tz: defaultCity?.tz ?? 'UTC',
            country: loc.country,
            state: loc.state,
            address: loc.address,
          });
          console.warn(`[bulk-create] Geocoding failed for "${loc.name}, ${loc.country}" — using ${defaultCity ? 'default' : 'zero'} coordinates`);
        }
      }
    }
    if (resolved.length > 0) customLocations = resolved;
  }

  // Fetch categories — tenants will be distributed evenly across all categories
  const { data: categories } = await auth.supabase
    .from('categories')
    .select('id, name, slug')
    .order('display_order', { ascending: true });
  const categoryList = ((categories ?? []) as { id: string; name: string; slug: string }[]);

  // (Category slug -> biz type bucket mapping is resolved inline in the loop below.)

  // Per-run uniqueness tracking: each bucket keeps a shuffled queue of names/logos
  // that we pop from. Beyond the pool we append a numeric suffix / picsum fallback.
  function shuffled<T>(arr: readonly T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
  }
  const nameQueues: Record<string, string[]> = {};
  const logoQueues: Record<string, string[]> = {};
  const nameOverflow: Record<string, number> = {};
  const logoOverflow: Record<string, number> = {};
  for (const key of Object.keys(BUSINESS_TYPES)) {
    nameQueues[key] = shuffled(BUSINESS_TYPES[key]!.names);
    logoQueues[key] = shuffled(LOGO_IMAGES[key] ?? []);
    nameOverflow[key] = 0;
    logoOverflow[key] = 0;
  }
  function nextUniqueName(bucketKey: string): string {
    const q = nameQueues[bucketKey];
    if (q && q.length > 0) return q.pop()!;
    // Pool exhausted — reuse base names with a numeric suffix.
    const base = BUSINESS_TYPES[bucketKey]?.names ?? [];
    if (base.length === 0) return `Test Tenant ${Date.now().toString(36)}`;
    nameOverflow[bucketKey] = (nameOverflow[bucketKey] ?? 0) + 1;
    const idx = (nameOverflow[bucketKey]! - 1) % base.length;
    const suffix = Math.floor((nameOverflow[bucketKey]! - 1) / base.length) + 2;
    return `${base[idx]} ${suffix}`;
  }
  function nextUniqueLogo(bucketKey: string): string {
    const q = logoQueues[bucketKey];
    if (q && q.length > 0) return q.pop()!;
    // Pool exhausted — fall back to picsum with a deterministic unique seed.
    logoOverflow[bucketKey] = (logoOverflow[bucketKey] ?? 0) + 1;
    const seed = `${bucketKey}-${Date.now().toString(36)}-${logoOverflow[bucketKey]}`;
    return `https://picsum.photos/seed/${seed}/400/400`;
  }

  // Fetch a default plan
  const { data: defaultPlan } = await auth.supabase
    .from('subscription_plans')
    .select('id')
    .order('price_monthly', { ascending: true })
    .limit(1)
    .single();

  const results: { tenant_id: string; name: string; category: string; locations: number; staff: number; services: number; gallery: number; rating: number }[] = [];

  for (let i = 0; i < count; i++) {
    // Evenly distribute across categories: tenant 0 -> cat 0, tenant 1 -> cat 1, etc.
    const category = categoryList.length > 0 ? categoryList[i % categoryList.length] : null;
    const categoryId = category?.id ?? null;
    // Resolve biz type by category slug (fallback: wellness).
    const bucketKey = category
      ? (CATEGORY_SLUG_TO_BIZTYPE[category.slug] ?? 'wellness')
      : 'wellness';
    const bizName = nextUniqueName(bucketKey);
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const ownerName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}+${Date.now().toString(36).slice(-3)}${i}@test.balkina.ai`;

    const categoryLabel = category?.name ?? 'Uncategorized';

    // Pick a category-appropriate logo — pop from the unique queue
    const logoUrl = nextUniqueLogo(bucketKey);

    // Create tenant
    const { data: tenant, error: tenantError } = await auth.supabase
      .from('tenants')
      .insert({
        name: bizName,
        owner_name: ownerName,
        email,
        phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
        category_id: categoryId,
        subscription_plan_id: defaultPlan?.id ?? null,
        status: 'active',
        payments_enabled: Math.random() > 0.5,
        logo_url: logoUrl,
      } as never)
      .select('id')
      .single();

    if (tenantError || !tenant) continue;

    const tenantId = (tenant as { id: string }).id;
    let locCount = 0;
    let staffCount = 0;
    let svcCount = 0;
    const locationIds: string[] = [];
    const staffIds: string[] = [];

    // Create locations
    const citiesToUse = customLocations
      ? customLocations
      : [...DEFAULT_CITIES].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1);

    for (const cityData of citiesToUse) {
      const streetNum = Math.floor(100 + Math.random() * 9900);
      const streetName = `${streetNum} Main St`;
      const addressParts = [streetName, cityData.name, cityData.state, cityData.country].filter(Boolean);
      const fullAddress = cityData.address ?? addressParts.join(', ');
      const { data: loc } = await auth.supabase
        .from('tenant_locations')
        .insert({
          tenant_id: tenantId,
          name: `${bizName} - ${cityData.name}`,
          address: fullAddress,
          street_address: cityData.address ? null : streetName,
          city: cityData.name,
          state: cityData.state ?? null,
          country: cityData.country ?? null,
          latitude: cityData.lat + randomFloat(-0.005, 0.005),
          longitude: cityData.lng + randomFloat(-0.005, 0.005),
          timezone: cityData.tz,
          phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
        } as never)
        .select('id')
        .single();

      if (loc) {
        locationIds.push((loc as { id: string }).id);
        locCount++;
      }
    }

    // Create 2-5 staff
    if (withStaff) {
      const numStaff = Math.floor(Math.random() * 4) + 2;
      const names = [...STAFF_NAMES].sort(() => Math.random() - 0.5).slice(0, numStaff);

      for (let si = 0; si < names.length; si++) {
        const staffName = names[si] as string;
        // Generate a realistic weekly schedule (Mon-Sat, ~9AM-5PM with slight variation)
        const scheduleStart = 8 + Math.floor(Math.random() * 2); // 8 or 9
        const scheduleEnd = 17 + Math.floor(Math.random() * 2);  // 17 or 18
        const startTime = `${String(scheduleStart).padStart(2, '0')}:00`;
        const endTime = `${String(scheduleEnd).padStart(2, '0')}:00`;
        const availabilitySchedule: Record<string, { start: string; end: string }> = {};
        for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
          availabilitySchedule[day] = { start: startTime, end: endTime };
        }

        const { data: s } = await auth.supabase
          .from('staff')
          .insert({
            tenant_id: tenantId,
            name: staffName,
            email: `${staffName.toLowerCase().replace(' ', '.')}+${Date.now().toString(36).slice(-3)}@test.balkina.ai`,
            status: 'active',
            availability_schedule: availabilitySchedule,
            image_url: STAFF_IMAGES[si % STAFF_IMAGES.length],
          } as never)
          .select('id')
          .single();

        if (s) {
          const sId = (s as { id: string }).id;
          staffIds.push(sId);
          staffCount++;

          // Assign to random location(s)
          if (locationIds.length > 0) {
            const assignedLoc = randomItem(locationIds);
            await auth.supabase
              .from('staff_locations')
              .insert({ staff_id: sId, location_id: assignedLoc } as never);
          }
        }
      }
    }

    // Create services
    if (withServices) {
      const templates = SERVICE_TEMPLATES[bucketKey] ?? [];
      const svcImagePool = SERVICE_IMAGES[bucketKey] ?? Object.values(SERVICE_IMAGES).flat();
      for (let ti = 0; ti < templates.length; ti++) {
        const tmpl = templates[ti] as { name: string; price: number; duration: number };
        const { data: svc } = await auth.supabase
          .from('services')
          .insert({
            tenant_id: tenantId,
            name: tmpl.name,
            price: tmpl.price,
            duration_minutes: tmpl.duration,
            visibility: 'public',
            image_url: svcImagePool[ti % svcImagePool.length],
          } as never)
          .select('id')
          .single();

        if (svc) {
          const svcId = (svc as { id: string }).id;
          svcCount++;

          // Assign all staff to this service
          for (const sid of staffIds) {
            await auth.supabase
              .from('service_staff')
              .insert({ service_id: svcId, staff_id: sid } as never);
          }

          // Assign to all locations
          for (const lid of locationIds) {
            await auth.supabase
              .from('service_locations')
              .insert({ service_id: svcId, location_id: lid } as never);
          }
        }
      }
    }

    // Create gallery photos (3-5 per location).
    // To maximise uniqueness across tenants: start each tenant at a different
    // rotating offset in the gallery pool, and fill any remaining slots with
    // picsum-seeded images so two tenants never get the exact same gallery.
    const galleryPool = GALLERY_IMAGES[bucketKey] ?? Object.values(GALLERY_IMAGES).flat();
    let galleryCount = 0;
    for (let lIdx = 0; lIdx < locationIds.length; lIdx++) {
      const lid = locationIds[lIdx]!;
      const numPhotos = Math.floor(Math.random() * 3) + 3; // 3-5
      const photos: string[] = [];
      // Rotate offset so tenant i + location j get different slices of the pool.
      const offset = (i * 3 + lIdx) % Math.max(1, galleryPool.length);
      for (let gi = 0; gi < numPhotos; gi++) {
        if (gi < galleryPool.length) {
          photos.push(galleryPool[(offset + gi) % galleryPool.length]!);
        } else {
          // Pool too small — fall back to picsum-seeded unique images.
          photos.push(`https://picsum.photos/seed/${bucketKey}-${tenantId}-${lIdx}-${gi}/1200/800`);
        }
      }
      for (let gi = 0; gi < photos.length; gi++) {
        const { error: gErr } = await auth.supabase
          .from('location_gallery')
          .insert({
            location_id: lid,
            tenant_id: tenantId,
            image_url: photos[gi],
            caption: null,
            sort_order: gi,
          } as never);
        if (!gErr) galleryCount++;
      }
    }

    // Set random ratings (3.5-5.0 avg_rating, 5-120 review_count)
    const avgRating = Math.round((3.5 + Math.random() * 1.5) * 10) / 10;
    const reviewCount = Math.floor(Math.random() * 116) + 5;
    await auth.supabase
      .from('tenants')
      .update({ avg_rating: avgRating, review_count: reviewCount } as never)
      .eq('id', tenantId);

    // Set random staff ratings too
    for (const sid of staffIds) {
      const staffRating = Math.round((3.0 + Math.random() * 2.0) * 10) / 10;
      const staffReviewCount = Math.floor(Math.random() * 50) + 1;
      await auth.supabase
        .from('staff')
        .update({ avg_rating: staffRating, review_count: staffReviewCount } as never)
        .eq('id', sid);
    }

    results.push({ tenant_id: tenantId, name: bizName, category: categoryLabel, locations: locCount, staff: staffCount, services: svcCount, gallery: galleryCount, rating: avgRating });
  }

  return NextResponse.json({
    created: results.length,
    tenants: results,
  }, { status: 201 });
}
