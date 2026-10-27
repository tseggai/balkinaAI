# Balkina Instagram templates — one per business category

Twelve categories, each with a square (1080×1080) and a story (1080×1920) brand template.
Per category the eyebrow, url, logo and background pattern never change; only the headline,
subline and photo do.

## Names (exactly, the sync keys on the word)

| # | Category | Square | Story | Eyebrow EN (default) | Eyebrow SR |
|---|---|---|---|---|---|
| 01 | Health & Wellness | `IG · 01 health · square` | `IG · 01 health · story` | HEALTH & WELLNESS | ZDRAVLJE I WELLNESS |
| 02 | Beauty & Personal Care | `IG · 02 beauty · square` | `IG · 02 beauty · story` | BEAUTY & PERSONAL CARE | LEPOTA I NEGA |
| 03 | Fitness & Sports | `IG · 03 fitness · square` | `IG · 03 fitness · story` | FITNESS & SPORTS | FITNES I SPORT |
| 04 | Home Services | `IG · 04 home · square` | `IG · 04 home · story` | HOME SERVICES | USLUGE ZA DOM |
| 05 | Professional Services | `IG · 05 professional · square` | `IG · 05 professional · story` | PROFESSIONAL SERVICES | PROFESIONALNE USLUGE |
| 06 | Education & Tutoring | `IG · 06 education · square` | `IG · 06 education · story` | EDUCATION & TUTORING | EDUKACIJA I ČASOVI |
| 07 | Pet Services | `IG · 07 pets · square` | `IG · 07 pets · story` | PET SERVICES | USLUGE ZA LJUBIMCE |
| 08 | Automotive | `IG · 08 auto · square` | `IG · 08 auto · story` | AUTOMOTIVE | AUTO USLUGE |
| 09 | Events & Entertainment | `IG · 09 events · square` | `IG · 09 events · story` | EVENTS & ENTERTAINMENT | DOGAĐAJI I ZABAVA |
| 10 | Food & Nutrition | `IG · 10 food · square` | `IG · 10 food · story` | FOOD & NUTRITION | HRANA I ISHRANA |
| 11 | Rentals & Tours | `IG · 11 rentals · square` | `IG · 11 rentals · story` | RENTALS & TOURS | IZNAJMLJIVANJE I TURE |
| 12 | Hospitality | `IG · 12 hospitality · square` | `IG · 12 hospitality · story` | HOSPITALITY | UGOSTITELJSTVO |

The number only orders the list; a hyphen instead of the middle dot also works. The word must match.
Hospitality (restaurants, cafés, venues, hotels) is the twelfth category in the taxonomy and is not in
the PDF yet.

## Data fields (Apps → Bulk Create → Enter data manually)

| Column | Type | Who fills it | Notes |
|---|---|---|---|
| `eyebrow` | text | the studio, with the category name in the post's language | keep the yellow pill as designed; the box just needs room for the SR text, which is a little longer |
| `headline` | text | copywriter | up to ~60 characters, one text style (see below) |
| `subline` | text | copywriter | up to ~70 characters |
| `url` | text | fixed `balkina.ai` | can stay as a field or be plain text |
| `photo` | image | the studio | must be a **Frame** (Elements → Frames), the photo dropped into it |

Logo: leave it as a plain element (no data field), or as an image field named `logo` which the studio ignores.

## Two things the PDF shows that the API cannot do

1. **Mixed styles inside the headline** (the bold "rezervisana." / "poslednji cas."). Autofill replaces the
   whole text of a box, so the result takes one style. Pick one headline style per template, or put the
   emphasis line in its own box: the studio sends only `headline` and `subline`, so a second headline box
   would need a new field and a change in the copywriter. One style is the simpler path.
2. **Diacritics**: the PDF text is missing them (sto, cas, propustenih). The copywriter writes proper
   č ć š ž đ, so check the fonts you use render them (Quicksand does).

## Fastest way to produce the 24

1. Finish the 12 square variants as pages of one working file so they stay consistent.
2. For each page: duplicate the file, delete the other pages, connect the five fields, Share → Brand
   Template with the name above. Connections survive the duplicate, so after the first one only the
   photo frame needs a check.
3. Story: Resize the square file to 1080×1920, adjust the pattern and frame per page, repeat step 2 with
   the `story` names.
4. In the admin: Instagram → Sync from Canva → Show templates → Test render on each. The studio picks up
   every category as soon as its square is synced; a story is used when it exists.
