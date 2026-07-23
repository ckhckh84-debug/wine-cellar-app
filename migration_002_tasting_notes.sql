-- 시음노트 구조화 마이그레이션 (맛/향 항목 세분화, 음식 페어링 추가)
-- Supabase SQL Editor에서 실행하세요. 기존 aroma/taste/body 텍스트 데이터는 삭제됩니다.

alter table tasting_notes
  add column if not exists acidity int,
  add column if not exists tannin int,
  add column if not exists body_level int,
  add column if not exists aroma_primary text[],
  add column if not exists aroma_secondary text[],
  add column if not exists food_pairing text;

alter table tasting_notes drop column if exists aroma;
alter table tasting_notes drop column if exists taste;
alter table tasting_notes drop column if exists body;
