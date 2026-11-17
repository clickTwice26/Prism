-- Lessons: the shared class content every learner opens.
CREATE TABLE lessons (
    id          BIGSERIAL PRIMARY KEY,
    subject     TEXT NOT NULL DEFAULT '',
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    language    TEXT NOT NULL DEFAULT 'en',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Images attached to a lesson, with a teacher-approved description for blind
-- learners. AI drafts stay unapproved until a teacher checks them.
CREATE TABLE lesson_images (
    id                    BIGSERIAL PRIMARY KEY,
    lesson_id             BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    caption               TEXT NOT NULL DEFAULT '',
    description           TEXT NOT NULL DEFAULT '',
    description_approved  BOOLEAN NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every simplification, so quality can be reviewed later.
CREATE TABLE simplify_logs (
    id               BIGSERIAL PRIMARY KEY,
    language         TEXT NOT NULL,
    source           TEXT NOT NULL,            -- ai | rules
    original_text    TEXT NOT NULL,
    simplified_text  TEXT NOT NULL,
    grade_before     INT,                      -- NULL when no reading-level formula fits the language
    grade_after      INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lightweight feature-usage analytics.
CREATE TABLE usage_events (
    id          BIGSERIAL PRIMARY KEY,
    feature     TEXT NOT NULL,
    action      TEXT NOT NULL,
    meta        JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_feature_idx ON usage_events (feature);

-- Validation study: anonymised participants and with/without-tool results.
CREATE TABLE study_participants (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,          -- e.g. P01
    profile     TEXT NOT NULL,                 -- e.g. low vision, dyslexia, none
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE study_results (
    id                    BIGSERIAL PRIMARY KEY,
    participant_id        BIGINT NOT NULL REFERENCES study_participants(id) ON DELETE CASCADE,
    feature               TEXT NOT NULL,
    condition             TEXT NOT NULL CHECK (condition IN ('with_tool', 'without_tool')),
    comprehension_score   INT CHECK (comprehension_score BETWEEN 0 AND 100),
    task_completed        BOOLEAN NOT NULL DEFAULT false,
    time_seconds          INT,
    sus_score             REAL CHECK (sus_score BETWEEN 0 AND 100),
    satisfaction          INT CHECK (satisfaction BETWEEN 1 AND 5),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX study_results_participant_idx ON study_results (participant_id);
