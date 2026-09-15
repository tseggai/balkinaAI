/* eslint-disable @typescript-eslint/no-explicit-any */
// Original seeded slide content — lets the admin 'Restore from starter' a slide.
// Generated from packages/db/migrations/064 (white-label) and 066 (tenant).
import type { DeckId } from './types';

export interface Starter {
  template: string;
  label: string;
  content: any;
}

export const STARTERS: Record<DeckId, Starter[]> = {
 "tenant": [
  {
   "template": "cover",
   "label": "01 · Automate your booking & fill up your calendar",
   "content": {
    "mark": {
     "en": "Balkina AI · For Your Business",
     "sr": "Balkina AI · Za vaš biznis"
    },
    "title": {
     "en": "Automate your booking & fill up your calendar",
     "sr": "Automatizujte zakazivanje i popunite svoj kalendar"
    },
    "lede": {
     "en": "with Balkina — an AI booking platform where new customers find you, regulars rebook more often, and your schedule takes care of itself.",
     "sr": "uz Balkinu — AI platformu za zakazivanje na kojoj vas novi klijenti pronalaze, stalni se vraćaju češće, a raspored se vodi sam."
    }
   }
  },
  {
   "template": "types",
   "label": "02 · Built For",
   "content": {
    "eyebrow": {
     "en": "Built For",
     "sr": "Napravljeno za"
    },
    "items": [
     {
      "label": {
       "en": "Salons",
       "sr": "Salone"
      }
     },
     {
      "label": {
       "en": "Barbershops",
       "sr": "Berbernice"
      }
     },
     {
      "label": {
       "en": "Spas",
       "sr": "Spa centre"
      }
     },
     {
      "label": {
       "en": "Trainers",
       "sr": "Trenere"
      }
     },
     {
      "label": {
       "en": "Clinics",
       "sr": "Ordinacije"
      }
     },
     {
      "label": {
       "en": "Dentists",
       "sr": "Stomatologe"
      }
     },
     {
      "label": {
       "en": "Physiotherapists",
       "sr": "Fizioterapeute"
      }
     },
     {
      "label": {
       "en": "Nail studios",
       "sr": "Nail studije"
      }
     },
     {
      "label": {
       "en": "Massage",
       "sr": "Masaže"
      }
     },
     {
      "label": {
       "en": "Yoga studios",
       "sr": "Joga studije"
      }
     },
     {
      "label": {
       "en": "Gyms",
       "sr": "Teretane"
      }
     },
     {
      "label": {
       "en": "Restaurants",
       "sr": "Restorane"
      }
     },
     {
      "label": {
       "en": "Cafés",
       "sr": "Kafiće"
      }
     },
     {
      "label": {
       "en": "Tour operators",
       "sr": "Turističke agencije"
      }
     },
     {
      "label": {
       "en": "Experiences",
       "sr": "Doživljaje"
      }
     }
    ]
   }
  },
  {
   "template": "problem",
   "label": "03 · Bookings you never even saw are going to someone else",
   "content": {
    "eyebrow": {
     "en": "The Problem",
     "sr": "Problem"
    },
    "title": {
     "en": "Bookings you never even saw are going to someone else",
     "sr": "Rezervacije koje niste ni videli odlaze nekom drugom"
    },
    "gaps": [
     {
      "heading": {
       "en": "Hard to discover",
       "sr": "Teško vas je pronaći"
      },
      "text": {
       "en": "New customers can't find you — discovery today is word of mouth and whoever shows up first on Google",
       "sr": "Novi klijenti ne znaju za vas — otkrivanje se danas svodi na preporuke i na to ko prvi iskoči na Google-u"
      }
     },
     {
      "heading": {
       "en": "Slow to book",
       "sr": "Sporo zakazivanje"
      },
      "text": {
       "en": "Booking happens over calls, DMs and email back-and-forth — hours to close what should take seconds",
       "sr": "Rezervacije idu preko poziva, poruka i mejlova — satima se zatvara ono što traje sekunde"
      }
     },
     {
      "heading": {
       "en": "Missed demand",
       "sr": "Propuštena tražnja"
      },
      "text": {
       "en": "Calls while your hands are busy and messages at midnight go unanswered — those bookings go elsewhere",
       "sr": "Pozivi dok su vam ruke zauzete i poruke u ponoć ostaju bez odgovora — te rezervacije odu drugom"
      }
     },
     {
      "heading": {
       "en": "Forgotten regulars",
       "sr": "Zaboravljeni stalni klijenti"
      },
      "text": {
       "en": "Your best customers drift — not because they left, but because nobody reminded them they're due",
       "sr": "Najbolji klijenti se osipaju — ne zato što su otišli, već zato što ih niko nije podsetio da je vreme"
      }
     }
    ]
   }
  },
  {
   "template": "overview",
   "label": "04 · Run your business end to end with one tool",
   "content": {
    "eyebrow": {
     "en": "The Platform",
     "sr": "Platforma"
    },
    "title": {
     "en": "Run your business end to end with one tool",
     "sr": "Vodite svoj biznis od početka do kraja uz jedan alat"
    },
    "lede": {
     "en": "Every module below is included. The next slides go through each one.",
     "sr": "Svaki modul ispod je uključen. Naredni slajdovi prolaze kroz svaki od njih."
    },
    "features": [
     {
      "name": {
       "en": "AI receptionist",
       "sr": "AI recepcioner"
      },
      "desc": {
       "en": "books for you 24/7 in chat — instant or with your approval",
       "sr": "zakazuje umesto vas 24/7 u chatu — odmah ili uz vaše odobrenje"
      }
     },
     {
      "name": {
       "en": "Discovery in the app",
       "sr": "Otkrivanje u aplikaciji"
      },
      "desc": {
       "en": "nearby customers find you with open slots",
       "sr": "klijenti u blizini vas pronalaze sa slobodnim terminima"
      }
     },
     {
      "name": {
       "en": "Your booking link",
       "sr": "Vaš link za rezervacije"
      },
      "desc": {
       "en": "Instagram, Google, WhatsApp — one link, direct bookings",
       "sr": "Instagram, Google, WhatsApp — jedan link, direktne rezervacije"
      }
     },
     {
      "name": {
       "en": "Smart rebooking",
       "sr": "Pametno ponovno zakazivanje"
      },
      "desc": {
       "en": "AI nudges regulars when they're due",
       "sr": "AI podseća stalne klijente kada im je vreme"
      }
     },
     {
      "name": {
       "en": "Reminders",
       "sr": "Podsetnici"
      },
      "desc": {
       "en": "AI and SMS reminders cut no-shows",
       "sr": "AI i SMS podsetnici smanjuju nedolaske"
      }
     },
     {
      "name": {
       "en": "Customer CRM",
       "sr": "CRM klijenata"
      },
      "desc": {
       "en": "history and preferences in one profile",
       "sr": "istorija i navike u jednom profilu"
      }
     },
     {
      "name": {
       "en": "Services, staff & schedules",
       "sr": "Usluge, osoblje i rasporedi"
      },
      "desc": {
       "en": "durations, buffers, days off, locations",
       "sr": "trajanja, pauze, slobodni dani, lokacije"
      }
     },
     {
      "name": {
       "en": "Appointments",
       "sr": "Termini"
      },
      "desc": {
       "en": "approve, reschedule, reach customers in one tap",
       "sr": "odobrite, pomerite, kontaktirajte klijente jednim dodirom"
      }
     },
     {
      "name": {
       "en": "Coupons & packages",
       "sr": "Kuponi i paketi"
      },
      "desc": {
       "en": "entice new customers, upsell regulars",
       "sr": "privucite nove, prodajte više stalnima"
      }
     },
     {
      "name": {
       "en": "Calendar sync",
       "sr": "Sinhronizacija kalendara"
      },
      "desc": {
       "en": "Google two-way, iCal, Airbnb, Calendly",
       "sr": "Google dvosmerno, iCal, Airbnb, Calendly"
      }
     },
     {
      "name": {
       "en": "Travel platforms",
       "sr": "Turističke platforme"
      },
      "desc": {
       "en": "Bokun: Viator, GetYourGuide, Airbnb Experiences",
       "sr": "Bokun: Viator, GetYourGuide, Airbnb Experiences"
      }
     },
     {
      "name": {
       "en": "Restaurants & events",
       "sr": "Restorani i događaji"
      },
      "desc": {
       "en": "tables and ticketed evenings, same dashboard",
       "sr": "stolovi i večeri s ulaznicama, ista tabla"
      }
     }
    ]
   }
  },
  {
   "template": "points-chat",
   "label": "05 · Balkina AI receptionist that never sleeps",
   "content": {
    "eyebrow": {
     "en": "AI Receptionist",
     "sr": "AI recepcioner"
    },
    "title": {
     "en": "Balkina AI receptionist that never sleeps",
     "sr": "Balkina AI recepcioner koji nikad ne spava"
    },
    "points": [
     {
      "strong": {
       "en": "New customers will easily discover your business:",
       "sr": "Novi klijenti će lako otkriti vaš biznis:"
      },
      "text": {
       "en": "find real-time availability and book your services — day or night",
       "sr": "vide dostupnost u realnom vremenu i zakazuju vaše usluge — danju i noću"
      }
     },
     {
      "strong": {
       "en": "Instant confirmation or your approval:",
       "sr": "Trenutna potvrda ili vaše odobrenje:"
      },
      "text": {
       "en": "you decide which bookings need a yes from you",
       "sr": "vi odlučujete koje rezervacije traže vaš pristanak"
      }
     },
     {
      "strong": {
       "en": "Every booking lands in one calendar:",
       "sr": "Svaka rezervacija stiže u jedan kalendar:"
      },
      "text": {
       "en": "with the customer's details and history attached",
       "sr": "sa podacima i istorijom klijenta"
      }
     }
    ],
    "msgs": [
     {
      "who": "guest",
      "text": {
       "en": "Any openings for a cut and beard trim tomorrow after 5?",
       "sr": "Ima li termina za šišanje i bradu sutra posle 17h?"
      }
     },
     {
      "who": "bot",
      "text": {
       "en": "Marco has 5:30 or 6:15 free tomorrow. Both take 45 minutes — which suits you?",
       "sr": "Marko sutra ima slobodno u 17:30 ili 18:15. Oba termina traju 45 minuta — koji vam odgovara?"
      }
     },
     {
      "who": "guest",
      "text": {
       "en": "5:30, please.",
       "sr": "17:30, molim."
      }
     }
    ]
   }
  },
  {
   "template": "points",
   "label": "06 · New customers find you in the app",
   "content": {
    "eyebrow": {
     "en": "Discovery",
     "sr": "Otkrivanje"
    },
    "title": {
     "en": "New customers find you in the app",
     "sr": "Novi klijenti vas pronalaze u aplikaciji"
    },
    "points": [
     {
      "strong": {
       "en": "Found when it matters:",
       "sr": "Pronađeni kada je važno:"
      },
      "text": {
       "en": "when people nearby search for your service, our AI shows you with open time slots",
       "sr": "kada ljudi u blizini traže vašu uslugu, naš AI prikazuje vas sa slobodnim terminima"
      }
     },
     {
      "strong": {
       "en": "Reviews build your ranking:",
       "sr": "Recenzije grade vaš rang:"
      },
      "text": {
       "en": "good reviews mean priority placement when customers search",
       "sr": "dobre recenzije znače prioritet kada klijenti pretražuju"
      }
     },
     {
      "strong": {
       "en": "No ads to buy:",
       "sr": "Bez plaćenih oglasa:"
      },
      "text": {
       "en": "discovery comes with your listing — nothing extra to run",
       "sr": "otkrivanje dolazi uz vaš profil — ništa dodatno ne vodite"
      }
     }
    ],
    "kicker": {
     "en": "Let new customers find you easily",
     "sr": "Neka vas novi klijenti lako pronađu"
    }
   }
  },
  {
   "template": "points",
   "label": "07 · One link that books you everywhere",
   "content": {
    "eyebrow": {
     "en": "Booking Link",
     "sr": "Link za rezervacije"
    },
    "title": {
     "en": "One link that books you everywhere",
     "sr": "Jedan link koji vas zakazuje svuda"
    },
    "points": [
     {
      "strong": {
       "en": "Put it where customers already are:",
       "sr": "Stavite ga gde su klijenti već:"
      },
      "text": {
       "en": "Instagram bio, Google profile, WhatsApp replies",
       "sr": "Instagram bio, Google profil, WhatsApp odgovori"
      }
     },
     {
      "strong": {
       "en": "A booking page built for you:",
       "sr": "Stranica za rezervacije napravljena za vas:"
      },
      "text": {
       "en": "services, prices and live availability — customers book without the app",
       "sr": "usluge, cene i dostupnost uživo — klijenti rezervišu i bez aplikacije"
      }
     },
     {
      "strong": {
       "en": "Every booking lands in one calendar:",
       "sr": "Svaka rezervacija stiže u jedan kalendar:"
      },
      "text": {
       "en": "with the customer's details attached",
       "sr": "sa podacima klijenta"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "08 · Regulars come back before they drift",
   "content": {
    "eyebrow": {
     "en": "Regular Customers",
     "sr": "Stalni klijenti"
    },
    "title": {
     "en": "Regulars come back before they drift",
     "sr": "Stalni klijenti se vraćaju pre nego što se izgube"
    },
    "points": [
     {
      "strong": {
       "en": "Balkina learns their rhythm:",
       "sr": "Balkina uči njihov ritam:"
      },
      "text": {
       "en": "every four weeks, every summer — the AI knows when a regular is due",
       "sr": "svake četiri nedelje, svakog leta — AI zna kada je stalnom klijentu vreme"
      }
     },
     {
      "strong": {
       "en": "A nudge at the right moment:",
       "sr": "Podsticaj u pravom trenutku:"
      },
      "text": {
       "en": "a friendly push notification with a one-tap rebook",
       "sr": "prijateljska notifikacija sa ponovnim zakazivanjem jednim dodirom"
      }
     },
     {
      "strong": {
       "en": "You do nothing:",
       "sr": "Vi ne radite ništa:"
      },
      "text": {
       "en": "it runs in the background for every customer",
       "sr": "radi u pozadini za svakog klijenta"
      }
     }
    ],
    "kicker": {
     "en": "Let your loyal customers come back often",
     "sr": "Neka se verni klijenti često vraćaju"
    }
   }
  },
  {
   "template": "points",
   "label": "09 · Fewer no-shows, without the phone calls",
   "content": {
    "eyebrow": {
     "en": "Reminders",
     "sr": "Podsetnici"
    },
    "title": {
     "en": "Fewer no-shows, without the phone calls",
     "sr": "Manje nedolazaka, bez telefonskih poziva"
    },
    "points": [
     {
      "strong": {
       "en": "Automatic reminders:",
       "sr": "Automatski podsetnici:"
      },
      "text": {
       "en": "AI and SMS reminders before every appointment",
       "sr": "AI i SMS podsetnici pre svakog termina"
      }
     },
     {
      "strong": {
       "en": "Confirm or reschedule in one tap:",
       "sr": "Potvrda ili pomeranje jednim dodirom:"
      },
      "text": {
       "en": "customers fix their own plans — your calendar stays accurate",
       "sr": "klijenti sami sređuju svoje planove — vaš kalendar ostaje tačan"
      }
     },
     {
      "strong": {
       "en": "Your rules:",
       "sr": "Vaša pravila:"
      },
      "text": {
       "en": "choose when reminders go out and what they say",
       "sr": "izaberite kada podsetnici idu i šta piše u njima"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "10 · Remember every customer",
   "content": {
    "eyebrow": {
     "en": "Customer CRM",
     "sr": "CRM klijenata"
    },
    "title": {
     "en": "Remember every customer",
     "sr": "Zapamtite svakog klijenta"
    },
    "points": [
     {
      "strong": {
       "en": "One profile per customer:",
       "sr": "Jedan profil po klijentu:"
      },
      "text": {
       "en": "history, preferences, notes and no-shows",
       "sr": "istorija, navike, beleške i nedolasci"
      }
     },
     {
      "strong": {
       "en": "Context before they walk in:",
       "sr": "Kontekst pre nego što uđu:"
      },
      "text": {
       "en": "see what they had last time and who did it",
       "sr": "vidite šta su imali prošli put i ko je radio"
      }
     },
     {
      "strong": {
       "en": "Reach them directly:",
       "sr": "Kontaktirajte ih direktno:"
      },
      "text": {
       "en": "call, text, WhatsApp or email from the profile",
       "sr": "poziv, poruka, WhatsApp ili mejl iz profila"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "11 · Services, staff and schedules — set once",
   "content": {
    "eyebrow": {
     "en": "Set Up Your Business",
     "sr": "Podesite svoj biznis"
    },
    "title": {
     "en": "Services, staff and schedules — set once",
     "sr": "Usluge, osoblje i rasporedi — podesite jednom"
    },
    "points": [
     {
      "strong": {
       "en": "Services the way you sell them:",
       "sr": "Usluge onako kako ih prodajete:"
      },
      "text": {
       "en": "durations, prices, buffer times, add-ons",
       "sr": "trajanja, cene, pauze, dodaci"
      }
     },
     {
      "strong": {
       "en": "Staff and their hours:",
       "sr": "Osoblje i njihovo radno vreme:"
      },
      "text": {
       "en": "per-person availability, days off, who does what",
       "sr": "dostupnost po osobi, slobodni dani, ko šta radi"
      }
     },
     {
      "strong": {
       "en": "One location or many:",
       "sr": "Jedna lokacija ili više njih:"
      },
      "text": {
       "en": "each with its own hours and team",
       "sr": "svaka sa svojim radnim vremenom i timom"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "12 · Manage every appointment end to end",
   "content": {
    "eyebrow": {
     "en": "Appointments",
     "sr": "Termini"
    },
    "title": {
     "en": "Manage every appointment end to end",
     "sr": "Vodite svaki termin od početka do kraja"
    },
    "points": [
     {
      "strong": {
       "en": "Approve or auto-confirm:",
       "sr": "Odobrite ili automatski potvrdite:"
      },
      "text": {
       "en": "you decide which bookings need a yes from you",
       "sr": "vi odlučujete koje rezervacije traže vaš pristanak"
      }
     },
     {
      "strong": {
       "en": "Reschedule in seconds:",
       "sr": "Pomerite za par sekundi:"
      },
      "text": {
       "en": "drag to a new slot — the customer is notified",
       "sr": "prevucite na novi termin — klijent dobija obaveštenje"
      }
     },
     {
      "strong": {
       "en": "On your phone or desktop:",
       "sr": "Na telefonu ili računaru:"
      },
      "text": {
       "en": "the same calendar behind the counter and on the go",
       "sr": "isti kalendar iza pulta i u pokretu"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "13 · Entice new customers, upsell regulars",
   "content": {
    "eyebrow": {
     "en": "Coupons & Packages",
     "sr": "Kuponi i paketi"
    },
    "title": {
     "en": "Entice new customers, upsell regulars",
     "sr": "Privucite nove klijente, prodajte više stalnima"
    },
    "points": [
     {
      "strong": {
       "en": "Coupons:",
       "sr": "Kuponi:"
      },
      "text": {
       "en": "discount codes with limits and expiry, redeemed at booking",
       "sr": "kodovi za popust sa ograničenjima i rokom, iskorišćeni pri rezervaciji"
      }
     },
     {
      "strong": {
       "en": "Package deals:",
       "sr": "Paketi:"
      },
      "text": {
       "en": "bundle services or sessions at a better price",
       "sr": "spojite usluge ili sesije po boljoj ceni"
      }
     },
     {
      "strong": {
       "en": "Tracked automatically:",
       "sr": "Praćeno automatski:"
      },
      "text": {
       "en": "usage and revenue per offer, in your dashboard",
       "sr": "korišćenje i prihod po ponudi, u vašoj tabli"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "14 · Keep all your existing calendars in sync",
   "content": {
    "eyebrow": {
     "en": "Calendar Sync",
     "sr": "Sinhronizacija kalendara"
    },
    "title": {
     "en": "Keep all your existing calendars in sync",
     "sr": "Držite sve postojeće kalendare usklađene"
    },
    "points": [
     {
      "strong": {
       "en": "Google Calendar, two-way:",
       "sr": "Google kalendar, dvosmerno:"
      },
      "text": {
       "en": "Balkina bookings appear in Google; your busy times block Balkina automatically",
       "sr": "Balkina rezervacije se pojavljuju u Google-u; vaši zauzeti termini automatski blokiraju Balkinu"
      }
     },
     {
      "strong": {
       "en": "iCal everywhere:",
       "sr": "iCal svuda:"
      },
      "text": {
       "en": "export to Apple Calendar and Outlook; import Airbnb, Calendly and others",
       "sr": "izvezite u Apple Calendar i Outlook; uvezite Airbnb, Calendly i druge"
      }
     },
     {
      "strong": {
       "en": "Double-booking-proof:",
       "sr": "Bez duplih rezervacija:"
      },
      "text": {
       "en": "a busy slot anywhere is a busy slot everywhere",
       "sr": "zauzet termin bilo gde je zauzet svuda"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "15 · Sell on Viator and GetYourGuide — bookings flow straight in",
   "content": {
    "eyebrow": {
     "en": "Travel Platforms",
     "sr": "Turističke platforme"
    },
    "title": {
     "en": "Sell on Viator and GetYourGuide — bookings flow straight in",
     "sr": "Prodajete na Viator-u i GetYourGuide-u — rezervacije stižu same"
    },
    "points": [
     {
      "strong": {
       "en": "Connect Bokun once:",
       "sr": "Povežite Bokun jednom:"
      },
      "text": {
       "en": "your Viator, GetYourGuide and Airbnb Experiences bookings appear in Balkina",
       "sr": "vaše rezervacije s Viator-a, GetYourGuide-a i Airbnb Experiences-a se pojavljuju u Balkini"
      }
     },
     {
      "strong": {
       "en": "One capacity, everywhere:",
       "sr": "Jedan kapacitet, svuda:"
      },
      "text": {
       "en": "no overselling a tour that's already full",
       "sr": "bez preprodaje ture koja je već puna"
      }
     },
     {
      "strong": {
       "en": "Direct bookings too:",
       "sr": "I direktne rezervacije:"
      },
      "text": {
       "en": "locals and repeat guests book you commission-free",
       "sr": "lokalni i stalni gosti vas rezervišu bez provizije"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "points",
   "label": "16 · Balkina AI books tables and ticketed evenings, too",
   "content": {
    "eyebrow": {
     "en": "Hospitality",
     "sr": "Ugostiteljstvo"
    },
    "title": {
     "en": "Balkina AI books tables and ticketed evenings, too",
     "sr": "Balkina AI rezerviše i stolove i večeri s ulaznicama"
    },
    "points": [
     {
      "strong": {
       "en": "Table reservations:",
       "sr": "Rezervacije stolova:"
      },
      "text": {
       "en": "party size, your open hours, and your confirmation — you stay in control of the floor",
       "sr": "broj gostiju, vaše radno vreme i vaša potvrda — vi držite salu pod kontrolom"
      }
     },
     {
      "strong": {
       "en": "Ticketed experiences:",
       "sr": "Doživljaji s ulaznicama:"
      },
      "text": {
       "en": "brunches, tastings, holiday dinners with per-person pricing, capacity, and RSVPs",
       "sr": "branč, degustacije i praznične večere sa cenom po osobi, kapacitetom i prijavama"
      }
     },
     {
      "strong": {
       "en": "The same one dashboard:",
       "sr": "Ista jedna tabla:"
      },
      "text": {
       "en": "runs it all, from a single table for two to a sold-out New Year's Eve",
       "sr": "vodi sve — od stola za dvoje do rasprodatog dočeka Nove godine"
      }
     }
    ],
    "kicker": {
     "en": "",
     "sr": ""
    }
   }
  },
  {
   "template": "divider",
   "label": "17 · Get Started",
   "content": {
    "title": {
     "en": "Get Started",
     "sr": "Počnite"
    },
    "lede": {
     "en": "Free to try. Live in an afternoon",
     "sr": "Besplatno za probu. Aktivno za jedno popodne"
    },
    "mock": "booking"
   }
  },
  {
   "template": "points",
   "label": "18 · Free to start. Live in an afternoon",
   "content": {
    "eyebrow": {
     "en": "Easy Setup",
     "sr": "Lako podešavanje"
    },
    "title": {
     "en": "Free to start. Live in an afternoon",
     "sr": "Besplatno za početak. Aktivno za jedno popodne"
    },
    "points": [
     {
      "strong": {
       "en": "Create your account:",
       "sr": "Napravite nalog:"
      },
      "text": {
       "en": "sign up free in minutes, no credit card required",
       "sr": "registrujte se besplatno za par minuta, bez kreditne kartice"
      }
     },
     {
      "strong": {
       "en": "Add your services and staff:",
       "sr": "Dodajte usluge i osoblje:"
      },
      "text": {
       "en": "set durations, prices and working hours — Balkina builds your booking page",
       "sr": "podesite trajanja, cene i radno vreme — Balkina pravi vašu stranicu za rezervacije"
      }
     },
     {
      "strong": {
       "en": "Share your link and go live:",
       "sr": "Podelite svoj link i krenite:"
      },
      "text": {
       "en": "your first booking can arrive the same day",
       "sr": "prva rezervacija može stići istog dana"
      }
     }
    ],
    "kicker": {
     "en": "No hardware and nothing to install",
     "sr": "Bez opreme i bez instalacija"
    }
   }
  },
  {
   "template": "pricing",
   "label": "19 · Start free. Grow when you do",
   "content": {
    "eyebrow": {
     "en": "Pricing",
     "sr": "Cene"
    },
    "title": {
     "en": "Start free. Grow when you do",
     "sr": "Počnite besplatno. Rastite svojim tempom"
    },
    "kicker": {
     "en": "7-day free trial on every plan — no credit card, cancel anytime",
     "sr": "7 dana besplatne probe uz svaki plan — bez kartice, otkažite bilo kad"
    },
    "plans": [
     {
      "name": "Solo",
      "price": "€5",
      "per": {
       "en": "/mo",
       "sr": "/mes"
      },
      "aud": {
       "en": "For individuals getting started",
       "sr": "Za pojedince na početku"
      },
      "line": {
       "en": "1 staff · 1 location · 20 bookings/mo",
       "sr": "1 zaposleni · 1 lokacija · 20 rezervacija/mes"
      },
      "popular": false,
      "badge": {
       "en": "",
       "sr": ""
      }
     },
     {
      "name": "Solo Pro",
      "price": "€19",
      "per": {
       "en": "/mo",
       "sr": "/mes"
      },
      "aud": {
       "en": "For serious solo professionals",
       "sr": "Za ozbiljne solo profesionalce"
      },
      "line": {
       "en": "1 staff · 1 location · Unlimited bookings",
       "sr": "1 zaposleni · 1 lokacija · Neograničene rezervacije"
      },
      "popular": false,
      "badge": {
       "en": "",
       "sr": ""
      }
     },
     {
      "name": "Team",
      "price": "€49",
      "per": {
       "en": "/mo",
       "sr": "/mes"
      },
      "aud": {
       "en": "For small teams",
       "sr": "Za male timove"
      },
      "line": {
       "en": "Up to 5 staff · 2 locations · +€6/additional staff",
       "sr": "Do 5 zaposlenih · 2 lokacije · +6 €/dodatni zaposleni"
      },
      "popular": true,
      "badge": {
       "en": "Most Popular",
       "sr": "Najpopularniji"
      }
     },
     {
      "name": "Scale",
      "price": "€99",
      "per": {
       "en": "/mo",
       "sr": "/mes"
      },
      "aud": {
       "en": "For growing businesses",
       "sr": "Za rastuće biznise"
      },
      "line": {
       "en": "Up to 15 staff · 5 locations · +€6/additional staff",
       "sr": "Do 15 zaposlenih · 5 lokacija · +6 €/dodatni zaposleni"
      },
      "popular": false,
      "badge": {
       "en": "",
       "sr": ""
      }
     }
    ]
   }
  },
  {
   "template": "cta",
   "label": "20 · Put your bookings on",
   "content": {
    "eyebrow": {
     "en": "Get Started",
     "sr": "Počnite"
    },
    "title_pre": {
     "en": "Put your bookings on",
     "sr": "Prebacite rezervacije na"
    },
    "title_em": {
     "en": "autopilot",
     "sr": "autopilot"
    },
    "lede": {
     "en": "Create your account, add your services and staff, and share your link — you can take your first booking today",
     "sr": "Napravite nalog, dodajte usluge i osoblje i podelite svoj link — prvu rezervaciju možete primiti već danas"
    },
    "btn_label": {
     "en": "Start your free trial",
     "sr": "Započnite besplatnu probu"
    },
    "btn_url": "https://balkina.ai/join",
    "dlnote": {
     "en": "Download our app to see how your customers will experience it",
     "sr": "Preuzmite našu aplikaciju i pogledajte kako će je vaši klijenti doživeti"
    }
   }
  }
 ],
 "whitelabel": [
  {
   "template": "wl-cover",
   "label": "01 · Your property. Your app. One concierge.",
   "content": {
    "mark": "Balkina AI · White Label",
    "title": "Your property.\nYour app.\nOne concierge.",
    "sub": "A private, branded booking & community platform for resorts, marinas, and mixed-use destinations — serving the two audiences every great property depends on: its tenants and its residents."
   }
  },
  {
   "template": "wl-premise",
   "label": "02 · You built a destination.",
   "content": {
    "eyebrow": "The Premise",
    "title": "You built a destination.",
    "lede": "Restaurants and cafés, a spa and a marina, boutiques, events, private residences — dozens of experiences at one address. And your guests deserve to experience it as one seamless thread — not a phone number here, a walk-in there, a website that doesn't follow through.",
    "catalogue": [
     "Restaurants",
     "Spa & Wellness",
     "Marina",
     "Boutiques",
     "Fitness",
     "Events",
     "Residences"
    ]
   }
  },
  {
   "template": "wl-gaps",
   "label": "03 · Existing challenges.",
   "content": {
    "eyebrow": "What Fragmentation Costs",
    "title": "Existing challenges.",
    "gaps": [
     {
      "heading": "Discovery",
      "text": "Guests don't know what events and services are on-site — or how to book them."
     },
     {
      "heading": "Engagement",
      "text": "You own the address — not the relationship with your residents and guests."
     },
     {
      "heading": "Control",
      "text": "No unified booking for tenants — no visibility and data for the property owner."
     }
    ],
    "kicker": "Empty slots, under-filled evenings — a premium destination with a fragmented digital experience."
   }
  },
  {
   "template": "wl-duo",
   "label": "04 · A great property serves two audiences.",
   "content": {
    "eyebrow": "Our Thesis",
    "title": "A great property serves two audiences.",
    "cards": [
     {
      "heading": "Your tenants",
      "text": "The businesses that fill your destination with life. They need customers and calm operations — not another piece of software to wrestle."
     },
     {
      "heading": "Your residents",
      "text": "The people who chose to live in your world. They deserve recognition, a direct line to you, and a calendar worth staying for."
     }
    ],
    "kicker": "One branded app — your name on it — serves both. Balkina runs quietly underneath."
   }
  },
  {
   "template": "wl-divider",
   "label": "05 · Tenant support & management",
   "content": {
    "numeral": "I",
    "chapter": "Chapter One",
    "title": "Tenant support\n& management",
    "lede": "Bookings as a service — provided by you, to every business on your property."
   }
  },
  {
   "template": "wl-chat",
   "label": "06 · Every tenant, seamlessly bookable.",
   "content": {
    "eyebrow": "I · Seamless Bookability",
    "title": "Every tenant, seamlessly bookable.",
    "points": [
     {
      "strong": "One app for the whole property.",
      "text": "Restaurants, spa, activities, services — every business listed, browsed, and booked in seconds."
     },
     {
      "strong": "Real-time availability",
      "text": "with instant confirmation, approvals and deposits where the business wants them."
     },
     {
      "strong": "Your world only.",
      "text": "Guests discover and book what's inside your property — never a competitor."
     },
     {
      "strong": "And when they'd rather just ask",
      "text": "— the AI concierge takes it from there."
     }
    ],
    "msgs": [
     {
      "who": "guest",
      "text": "A massage after our sail on Saturday — and dinner for four at eight."
     },
     {
      "who": "concierge",
      "text": "With pleasure. Spa Azure has 5:30 free after your charter, and I'm holding a table for four at Terrace at 8:00."
     },
     {
      "who": "guest",
      "text": "Book both."
     }
    ]
   }
  },
  {
   "template": "wl-points",
   "label": "07 · A five-star back-office, included.",
   "content": {
    "eyebrow": "I · Management",
    "title": "A five-star back-office, included.",
    "points": [
     {
      "strong": "A full dashboard for every business",
      "text": "— services, staff, schedules, approvals, customers — with calendar sync to Google, iCal, and the travel platforms they already sell on."
     },
     {
      "strong": "Onboarding in minutes.",
      "text": "Invite a business, or approve its application; staff, hours and a storefront are provisioned automatically."
     },
     {
      "strong": "Nothing to learn twice.",
      "text": "No new hardware, no POS migration, no IT project."
     }
    ],
    "kicker": "You're not selling your tenants software. You're providing them customers."
   }
  },
  {
   "template": "wl-points",
   "label": "08 · Speak to every business at once — or precisely.",
   "content": {
    "eyebrow": "I · One Community of Businesses",
    "title": "Speak to every business at once — or precisely.",
    "points": [
     {
      "strong": "Message all tenants, a selection, or a whole category",
      "text": "— every restaurant before the regatta; the wellness group before the retreat."
     },
     {
      "strong": "Under your name.",
      "text": "Announcements, seasonal pushes, and operational notices arrive from the property, elegantly."
     },
     {
      "strong": "One view of the destination.",
      "text": "Bookings, campaigns, and activity across every business — finally in one place."
     }
    ],
    "kicker": ""
   }
  },
  {
   "template": "wl-divider",
   "label": "09 · Resident support & management",
   "content": {
    "numeral": "II",
    "chapter": "Chapter Two",
    "title": "Resident support\n& management",
    "lede": "Turn an address into a community."
   }
  },
  {
   "template": "wl-points",
   "label": "10 · Your residents, known by name.",
   "content": {
    "eyebrow": "II · Recognition",
    "title": "Your residents, known by name.",
    "points": [
     {
      "strong": "Verified in seconds.",
      "text": "A private code — or a personal invitation by email, SMS, or WhatsApp. No paperwork, no approval queue."
     },
     {
      "strong": "Each kind of resident, recognized as such:",
      "text": "homeowners, renters, commercial owners."
     },
     {
      "strong": "The concierge greets them accordingly.",
      "text": "“Welcome back — Villa 12.”"
     }
    ],
    "kicker": ""
   }
  },
  {
   "template": "wl-points",
   "label": "11 · A direct line to the people who matter most.",
   "content": {
    "eyebrow": "II · Connection",
    "title": "A direct line to the people who matter most.",
    "points": [
     {
      "strong": "Resident-only announcements",
      "text": "— visible to your community, invisible to passing visitors."
     },
     {
      "strong": "Reach exactly who you mean.",
      "text": "All members, or homeowners, renters, or commercial owners alone — by push, to their pocket."
     },
     {
      "strong": "News, notices, and privileges,",
      "text": "delivered under your brand rather than a printed flyer in a lobby."
     }
    ],
    "kicker": ""
   }
  },
  {
   "template": "wl-points",
   "label": "12 · Bring them together, beautifully.",
   "content": {
    "eyebrow": "II · Togetherness",
    "title": "Bring them together, beautifully.",
    "points": [
     {
      "strong": "Brunches, galas, tastings, regattas",
      "text": "— ticketed events with capacity, seatings, and deposits."
     },
     {
      "strong": "One-tap RSVP,",
      "text": "per-guest QR passes, and door check-in from an iPad."
     },
     {
      "strong": "Resident-only guest lists",
      "text": "when the evening calls for it."
     }
    ],
    "kicker": "The difference between an address and a community is a calendar."
   }
  },
  {
   "template": "wl-compare",
   "label": "13 · Build it, patch it — or brand it.",
   "content": {
    "eyebrow": "The Alternatives",
    "title": "Build it, patch it — or brand it.",
    "options": [
     {
      "heading": "Build your own",
      "items": [
       "Six to twelve months",
       "Six-figure budget",
       "Then you maintain it, forever"
      ],
      "best": false
     },
     {
      "heading": "Generic tools",
      "items": [
       "A different app per tenant",
       "Someone else's brand",
       "No concierge, no community"
      ],
      "best": false
     },
     {
      "heading": "Balkina, white-label",
      "items": [
       "Live in weeks",
       "Your name, your world only",
       "Concierge, residents & events included"
      ],
      "best": true
     }
    ]
   }
  },
  {
   "template": "wl-plans",
   "label": "14 · A boutique platform, at a subscription.",
   "content": {
    "eyebrow": "The Engagement",
    "title": "A boutique platform, at a subscription.",
    "plans": [
     {
      "name": "Petite",
      "price": "€899",
      "per": "/ month",
      "text": "For boutique properties. The full concierge, resident membership, events, and your management panel.",
      "hi": false
     },
     {
      "name": "Grande",
      "price": "€2,500",
      "per": "/ month",
      "text": "For established destinations with a broad collection of businesses and an active events calendar.",
      "hi": false
     },
     {
      "name": "Estate",
      "price": "€5,600",
      "per": "/ month",
      "text": "Up to fifty businesses. Full destination scale — concierge, residents, and events across the property.",
      "hi": true
     },
     {
      "name": "Bespoke",
      "price": "Custom",
      "per": "",
      "text": "Beyond fifty businesses, multi-property portfolios, and bespoke integrations — composed to measure.",
      "hi": false
     }
    ]
   }
  },
  {
   "template": "wl-proof",
   "label": "15 · See it live at",
   "content": {
    "eyebrow": "In the World",
    "title_pre": "See it live at",
    "title_em": "Portonovi",
    "lede": "A branded concierge app for a luxury marina resort on the Adriatic — on-property booking, verified residents, private events. Your property could be next, in three weeks.",
    "buttons": [
     {
      "label": "Book a private walkthrough",
      "url": "https://calendly.com/balkina",
      "style": "gold"
     },
     {
      "label": "Experience Portonovi live",
      "url": "https://balkina.ai",
      "style": "line"
     }
    ]
   }
  }
 ]
};
