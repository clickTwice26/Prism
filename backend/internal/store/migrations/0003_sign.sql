-- Prism Sign: Bangla Sign Language glossary, interpreter videos and the
-- community lexicon (N5). See docs/sign-language-plan.md.

-- A concept that should have a sign, such as "chlorophyll". One sign serves
-- every written language, so a term carries a label per language.
CREATE TABLE sign_terms (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The written form of a term in one language. norm is the lower-cased,
-- trimmed label used for matching and to stop duplicate terms.
CREATE TABLE sign_term_labels (
    term_id  BIGINT NOT NULL REFERENCES sign_terms(id) ON DELETE CASCADE,
    lang     TEXT NOT NULL,
    label    TEXT NOT NULL,
    norm     TEXT NOT NULL,
    PRIMARY KEY (term_id, lang),
    UNIQUE (lang, norm)
);

-- The key terms of a lesson, in lesson order.
CREATE TABLE lesson_sign_terms (
    lesson_id  BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    term_id    BIGINT NOT NULL REFERENCES sign_terms(id) ON DELETE CASCADE,
    position   INT NOT NULL DEFAULT 0,
    source     TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('ai', 'teacher')),
    PRIMARY KEY (lesson_id, term_id)
);

-- A recorded sign video. kind = term (a 2-4 s glossary clip for one term) or
-- lesson (an interpreter's signed version of a whole lesson). Nothing reaches
-- learners until a deaf reviewer approves it. Approved clips for the same term
-- are regional variants and are kept side by side.
CREATE TABLE sign_videos (
    id           BIGSERIAL PRIMARY KEY,
    kind         TEXT NOT NULL CHECK (kind IN ('term', 'lesson')),
    term_id      BIGINT REFERENCES sign_terms(id) ON DELETE CASCADE,
    lesson_id    BIGINT REFERENCES lessons(id) ON DELETE CASCADE,
    file         TEXT NOT NULL UNIQUE,
    mime         TEXT NOT NULL,
    bytes        BIGINT NOT NULL,
    signer       TEXT NOT NULL,
    region       TEXT NOT NULL DEFAULT '',
    consent_at   TIMESTAMPTZ NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    reviewer     TEXT,
    review_note  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at  TIMESTAMPTZ,
    CHECK ((kind = 'term' AND term_id IS NOT NULL) OR (kind = 'lesson' AND lesson_id IS NOT NULL))
);
CREATE INDEX sign_videos_term_idx ON sign_videos (term_id, status);
CREATE INDEX sign_videos_lesson_idx ON sign_videos (lesson_id, status);
CREATE INDEX sign_videos_status_idx ON sign_videos (status, created_at);
