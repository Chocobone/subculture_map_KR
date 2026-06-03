-- M100 #5: source_url UNIQUE 제약 추가
-- upsert ON CONFLICT (source_url) 를 위해 필요
-- 적용: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f 002_add_source_url_unique.sql

ALTER TABLE events
  ADD CONSTRAINT events_source_url_unique UNIQUE (source_url);
