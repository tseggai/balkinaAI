# Places: booking a whole destination without the owner

Decided 2026-11-23. Status: plan and density watch are in place; nothing is built yet.

This replaces "pitch the property owner first" as the way the white-label product gets off the ground. The owner
pitch (docs/GTM_GROWTH_PLAN.md §2.2, §4.2, §5.2) stays, but it becomes the **second** step, made with usage numbers
in hand.

## 1. The idea

A property is a location. If the businesses inside it sign up to Balkina on their own, nobody's permission is
needed to group them:

- **A place** is a filter over independently signed-up businesses whose location falls inside a boundary.
- **In Balkina** it shows as a row on top: "Book anything in <place>". Tapping it opens a section that works like
  the white-label storefront (businesses → services → booking), scoped to that place. The chat scopes the same way
  ("book a facial in Porto").
- **On the web** each place gets a public page for search and QR codes. No separate app per place.
- **The owner comes later.** A live place with real bookings is the demo. The owner can then buy the official
  layer: their brand and domain, resident services, in-room and on-site placement, analytics.

Most of the flow exists: the white-label storefront, business pages and booking are in the app, scoped by
`properties` / `property_tenants` (`PropertyStorefront`, `handlePropertyFindBusinesses`). A place reuses them with
membership by geography instead of by an owner's contract.

## 2. Why this route (summary of the 2026-11-23 analysis)

Pitching the owner first is the weakest position:

- The top resorts have already built their own apps (Portonovi Resort app since 2021, a fuller Luštica Bay app,
  Porto Montenegro guest apps). "An app for your resort" is a pitch they believe they have solved.
- Selling experience apps to landlords is a consolidating, hard category (HqO, VTS/Lane, Equiem; VTS cut 20% of
  staff in 2024).
- The real problem is adoption, not the idea: trade sources put hotel native apps at single-digit to low-teens
  share of guests. A web link beats an app.
- An owner can copy a pitch. An owner cannot copy 40 signed-up businesses with live calendars.

Precedents:

| Case | What they did | Result | Lesson |
|---|---|---|---|
| DoorDash, Grubhub | Took orders for restaurants with no agreement | Lawsuits; California banned it in 2020 (AB 2149) | Never transact for a business that has not agreed |
| ClassPass | Showed non-partner salons as bookable | 2021 class action for false affiliation | Never imply a partnership that does not exist |
| ClassDojo | Free to teachers first, districts later | Reports one in five US districts adopting the district product in a year | Users first, gatekeeper second works |
| OpenTable | Software useful to a restaurant alone, diners later | Nearly failed spread thin; recovered in four dense cities | Density in one place before the next |
| Navily | Independent guide to every marina; booking only at partner marinas | Reports 1M+ boaters, 700+ bookable marinas | List the place, transact only with partners |

What we give up without the owner: their distribution (signage, directory, Wi-Fi, resident lists) and owner-run
features (property events, resident services, announcements). Revenue also starts lower: a few dozen businesses
at tenant prices against €899+ per month for one property contract.

## 3. Rules that do not bend

1. **Consent.** Only businesses that claimed their page (owner login) appear and can be booked. Unclaimed
   businesses are never shown as bookable. This is what separates us from the DoorDash / ClassPass failures.
2. **No owner brand.** Plain text only. No logo, no look-alike design, no domain or app named after the property.
   Every place page carries a line: independent businesses, not affiliated with the property owner.
3. **Same function, own look.** "Mimics the white label" means the same flow, never their identity.
4. **Legal check once** with Montenegrin counsel on trademark and unfair-competition limits before the first
   place row goes live. Apple requires permission for third-party trademarks in app names and metadata
   (App Review Guideline 5.2.1), which is one more reason the place lives inside Balkina.

## 4. The first three places (Montenegro)

| Working name | Refers to | Centre (lat, lng) | Radius | Naming note |
|---|---|---|---|---|
| **Porto** | Porto Montenegro, Tivat | 42.4354, 18.6935 | 0.7 km | Local shorthand, not the registered name. Still derived from the brand, so include it in the legal check. Purely geographic fallback: "Tivat Marina". |
| **Luštica** | Luštica Bay | 42.3912, 18.6679 | 1.5 km | The peninsula's own name. The safest of the three. |
| **(open)** | Portonovi, Kumbor | 42.4343, 18.6011 | 1.0 km | Not named yet. Candidate: **Kumbor**, the village it sits in, which is real geography. To decide before the row appears. |

Centres come from prospect records already in the database; radii are first estimates to tighten after a census
walk of each place.

## 5. Phase 0: start as plain Balkina

No place rows and no place names yet. Businesses in the three places are signed up one by one through the normal
tenant funnel (prospector → pre-provisioned page → claim). A place gets its name and its row only when it reaches
density.

Order of work:

1. **Census.** List every bookable business in each place (walk it, plus a prospector run centred on each place).
   The database knows very few today: 9 prospects around Porto, 1 around Luštica, 1 around Portonovi. The census
   gives the real denominator and may change the thresholds below.
2. **Check who runs the outlets.** Businesses run by the owner cannot sign without the owner. Count only
   independent operators in the census.
3. **Sign up, anchors first.** The spa, the beach club and the charter desk pull the others. Each business gets a
   QR for its counter and its Instagram bio: distribution no owner can block.
4. **Watch density** (§6). A weekly check reports when a place gets there (§7).

Season: the coast is quiet until May, so winter is for the census and sign-ups, with density expected for the
2027 season.

## 6. Density

A place is dense when "book anything in <place>" is true enough to say out loud.

**A business counts when all of these hold:**

- tenant `status = 'active'` with an owner login (`tenants.user_id` set), so it was claimed, not seeded;
- a location inside the place boundary (§4);
- at least one public service.

**Category families** (from the business's top-level category):

- **Dining**: Hospitality, Food & Nutrition
- **Care**: Beauty & Personal Care, Health & Wellness
- **Active**: Fitness & Sports, Rentals & Tours, Events & Entertainment

**Level 1 — name the place and show the row.** All four minimums met:

| Place | Businesses | Dining | Care | Active | Today (2026-11-23) |
|---|---|---|---|---|---|
| Porto | 15 | 4 | 2 | 2 | 3 businesses (0 dining, 0 care, 2 active) |
| Luštica | 8 | 3 | 1 | 1 | 1 business (1 active) |
| Portonovi | 10 | 3 | 1 | 1 | 0 |

**Level 2 — go to the owner with numbers.** Level 1 holds, and in the last 30 days:

- bookings ≥ 5 × the number of counted businesses, and
- at least half of the counted businesses took a booking.

These numbers are provisional. They are sized so a guest finds several choices for a meal, at least one way to be
looked after and at least one thing to do. After the census, raise a place's business minimum to 30% of its
independent bookable businesses if that is higher.

**The check** (read-only; thresholds live in the first `values` list):

```sql
with pl(place, lat, lng, km, need_total, need_dining, need_care, need_active) as (values
  ('porto',     42.4354, 18.6935, 0.7, 15, 4, 2, 2),
  ('lustica',   42.3912, 18.6679, 1.5,  8, 3, 1, 1),
  ('portonovi', 42.4343, 18.6011, 1.0, 10, 3, 1, 1)),
biz as (
  select distinct pl.place, t.id, coalesce(pc.name, c.name) as top
  from pl
  join tenant_locations l on l.latitude is not null
   and 6371 * acos(least(1, cos(radians(pl.lat)) * cos(radians(l.latitude)) * cos(radians(l.longitude) - radians(pl.lng)) + sin(radians(pl.lat)) * sin(radians(l.latitude)))) <= pl.km
  join tenants t on t.id = l.tenant_id and t.status = 'active' and t.user_id is not null
  left join categories c on c.id = t.category_id
  left join categories pc on pc.id = c.parent_id
  where exists (select 1 from services s where s.tenant_id = t.id and s.visibility = 'public')),
agg as (
  select pl.place, pl.need_total, pl.need_dining, pl.need_care, pl.need_active,
    count(b.id) as total,
    count(b.id) filter (where b.top in ('Hospitality', 'Food & Nutrition')) as dining,
    count(b.id) filter (where b.top in ('Beauty & Personal Care', 'Health & Wellness')) as care,
    count(b.id) filter (where b.top in ('Fitness & Sports', 'Rentals & Tours', 'Events & Entertainment')) as active,
    (select count(*) from appointments a where a.tenant_id in (select id from biz where place = pl.place) and a.created_at > now() - interval '30 days' and a.status <> 'cancelled') as bookings_30d,
    (select count(distinct a.tenant_id) from appointments a where a.tenant_id in (select id from biz where place = pl.place) and a.created_at > now() - interval '30 days' and a.status <> 'cancelled') as businesses_with_booking_30d
  from pl left join biz b on b.place = pl.place
  group by pl.place, pl.need_total, pl.need_dining, pl.need_care, pl.need_active)
select place, total, need_total, dining, need_dining, care, need_care, active, need_active, bookings_30d, businesses_with_booking_30d,
  (total >= need_total and dining >= need_dining and care >= need_care and active >= need_active) as level1_reached,
  (total >= need_total and dining >= need_dining and care >= need_care and active >= need_active
     and bookings_30d >= 5 * total and businesses_with_booking_30d * 2 >= total) as level2_reached
from agg order by place;
```

## 7. The reminder

A weekly scheduled task ("Balkina place density check", Mondays) runs the query above and reports:

- **when a place first reaches Level 1**: time to name it, run the legal check and build the row;
- **when a place first reaches Level 2**: time to take the numbers to the owner;
- otherwise one line with the current counts, so progress is visible.

If thresholds, centres or radii change, change them here and in the scheduled task together.

## 8. Data notes (2026-11-23)

- Around Porto there are 26 active tenants by coordinates, but only 3 have an owner login and a public service.
  The rest are active without an owner login. They are not counted, and it is worth confirming what they are,
  since active tenants are visible in discovery.
- The existing Portonovi portal lists 51 businesses, but none of them has coordinates inside the Portonovi
  boundary, so none counts toward density. Either their locations need coordinates or they are not independently
  claimed businesses.

## 9. Build scope when a place reaches Level 1

1. Generalise `properties` into places: an open place has no owner, no billing and no admin; membership comes
   from the boundary, not from `property_tenants`.
2. A row on the Balkina home screen, shown to users near the place or asking about it, that opens the storefront
   flow scoped to the place.
3. Chat scoping to a place.
4. A public web page per place.
5. The upgrade path: an owner claims the place and it becomes an official white-label property.

## 10. Other routes kept open

- **Small gatekeepers as the white-label buyer.** Villa and apartment managers, boutique hotels, charter
  companies and concierge firms own the guest relationship and decide in days. A co-branded guest link, self-serve.
- **Destinations with no owner.** Old towns, ski villages, city quarters, with the local tourism organisation as
  sponsor.
- **If pitching owners anyway:** single-decision-maker properties, revenue share and a time-boxed founding rate
  instead of a monthly fee.

## 11. Open questions

1. The name for the Portonovi place (candidate: Kumbor).
2. Where the Portonovi relationship stands, and whether its portal businesses are real and consented.
3. At each place, which outlets are independent tenants and which are run by the owner.
4. The legal check on "Porto" as a name.

## Sources

- California AB 2149 and non-partner delivery listings: https://www.restaurantbusinessonline.com/technology/california-puts-end-questionable-third-party-delivery-practice
- DoorDash non-partner listings suit: https://www.restaurantdive.com/news/doordash-accused-of-providing-deceptive-information-about-non-partners-on/585957/
- ClassPass class action: https://www.vice.com/en/article/classpass-faces-class-action-suit-over-phony-business-listings
- ClassDojo, ground-up adoption: https://blog.classdojo.com/how-to-change-education-from-the-ground-up/
- ClassDojo district adoption: https://www.k12dive.com/press-release/20260112-from-the-classroom-to-the-district-classdojo-becomes-the-all-in-one-commun/
- OpenTable single-player mode: https://www.trplane.com/en/opentable-competitive-advantage/
- OpenTable retreat to four cities: https://fortune.com/2009/08/14/opentable-the-hottest-spot-in-town/
- Navily: https://apps.apple.com/us/app/navily/id881103205
- Portonovi Resort app: https://apps.apple.com/app/id1579525207
- Luštica Bay app: https://apps.apple.com/us/app/lustica-bay/id1566342788
- Porto Montenegro guest apps: https://tradeonlytoday.com/dealers/mediterranean-marina-rolls-guest-apps/
- Hotel app adoption: https://hospitalitynet.org/news/4133921/beyond-the-app-download-how-to-build-a-frictionless-guest-journey-with-web-first-contactless-technology
- VTS layoffs: https://therealdeal.com/new-york/2024/08/15/vts-cuts-20-of-workforce/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

Company figures above (ClassDojo, Navily) are self-reported. No European court ruling on listing businesses
without consent was found; that is part of the legal check.
