-- 개인 와인 셀러 앱 스키마
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists "uuid-ossp";

create table if not exists wines (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  vintage int,
  producer text,
  variety text,
  region text,
  country text,
  style text,
  public_rating jsonb,           -- 예: {"Vivino": 4.2}
  my_rating numeric,
  quantity int not null default 1,
  storage_location text,
  purchase_date date,
  price numeric,
  drink_window_start int,
  drink_window_end int,
  food_pairing_tags text[],
  created_at timestamptz not null default now()
);

create table if not exists tasting_notes (
  id uuid primary key default uuid_generate_v4(),
  wine_id uuid not null references wines(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null default current_date,
  acidity int,                   -- 산도 1~5
  tannin int,                    -- 타닌 1~5
  body_level int,                -- 바디감 1~5
  aroma_primary text[],          -- 1차향 (과일/꽃/허브 등)
  aroma_secondary text[],        -- 2차향 (오크/효모/숙성 등)
  finish text,
  food_pairing text,             -- 함께 먹은 음식
  my_rating numeric,
  comment text,
  created_at timestamptz not null default now()
);

alter table wines enable row level security;
alter table tasting_notes enable row level security;

create policy "wines_owner_all" on wines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "tasting_notes_owner_all" on tasting_notes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists wines_owner_idx on wines(owner_id);
create index if not exists tasting_notes_wine_idx on tasting_notes(wine_id);
create index if not exists tasting_notes_owner_idx on tasting_notes(owner_id);
