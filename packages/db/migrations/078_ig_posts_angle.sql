-- Studio posts remember which Balkina capability they advertise (key from OPPORTUNITIES in
-- apps/admin/src/lib/ig/audience.ts), so the next post can pick one that has not been used lately.
alter table ig_posts add column if not exists angle text;
