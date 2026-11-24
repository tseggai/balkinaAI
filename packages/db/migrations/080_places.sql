-- Places (docs/PLACES.md): a destination grouped by geography from independently signed-up businesses.
-- A row is created by a person (name, boundary, thresholds); membership and density are computed from
-- tenant locations. Service role only: customers reach places through /api/places.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- the single display-name setting
  slug text not null unique,
  refers_to text,                        -- internal note, never shown to customers
  tagline text,
  photo_url text,
  lat double precision not null,
  lng double precision not null,
  radius_km numeric not null check (radius_km > 0 and radius_km <= 25),
  need_total integer not null default 10 check (need_total > 0),
  need_dining integer not null default 3 check (need_dining >= 0),
  need_care integer not null default 1 check (need_care >= 0),
  need_active integer not null default 1 check (need_active >= 0),
  status text not null default 'watching' check (status in ('draft', 'watching', 'live', 'official')),
  hidden boolean not null default false, -- set automatically when a published place thins out
  stats jsonb not null default '{}'::jsonb,
  stats_at timestamptz,
  level1_at timestamptz,                 -- first time the place reached Level 1
  level2_at timestamptz,                 -- first time it reached Level 2
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table places enable row level security;

insert into places (name, slug, refers_to, lat, lng, radius_km, need_total, need_dining, need_care, need_active, status) values
  ('Porto',     'porto',     'Porto Montenegro, Tivat',  42.4354, 18.6935, 0.7, 15, 4, 2, 2, 'watching'),
  ('Luštica',   'lustica',   'Luštica Bay',              42.3912, 18.6679, 1.5,  8, 3, 1, 1, 'watching'),
  ('Portonovi', 'portonovi', 'Portonovi, Kumbor',        42.4343, 18.6011, 1.0, 10, 3, 1, 1, 'watching')
on conflict (slug) do nothing;
