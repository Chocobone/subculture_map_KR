-- M100 #2: Aurora 초기 스키마 마이그레이션
-- 적용: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ips: 관심 IP (애니·게임 등 작품·캐릭터 시리즈)
CREATE TABLE ips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- events: 팝업스토어·콜라보·굿즈·한정 행사
CREATE TABLE events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_id       UUID        NOT NULL REFERENCES ips(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('popup', 'collab', 'goods', 'limited')),
  place       TEXT,
  place_url   TEXT,                   -- 네이버 지도 장소 직접 링크
  place_lat   DOUBLE PRECISION,       -- WGS84 위도 (33.0 ~ 38.6)
  place_lng   DOUBLE PRECISION,       -- WGS84 경도 (124.6 ~ 131.9)
  start_date  DATE,
  end_date    DATE,
  source_url  TEXT,
  status      TEXT        NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming', 'ongoing', 'ended')),
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- users: Cognito 연동 사용자 (id = Cognito sub)
CREATE TABLE users (
  id          UUID        PRIMARY KEY,
  email       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- subscriptions: 사용자 ↔ IP 관심 등록
CREATE TABLE subscriptions (
  user_id     UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  ip_id       UUID        NOT NULL REFERENCES ips(id)    ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ip_id)
);

-- 인덱스
CREATE INDEX idx_events_ip_id      ON events(ip_id);
CREATE INDEX idx_events_status     ON events(status);
CREATE INDEX idx_events_date_range ON events(start_date, end_date);
CREATE INDEX idx_events_place      ON events(place) WHERE place IS NOT NULL;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
