-- N2 fidelity gate -----------------------------------------------------------

-- Checked outputs, reused for every learner. source = auto (passed the
-- automatic checks) or teacher (approved in the review queue).
CREATE TABLE verified_layers (
    id          BIGSERIAL PRIMARY KEY,
    kind        TEXT NOT NULL,              -- simplify | describe
    lang        TEXT NOT NULL,
    variant     TEXT NOT NULL DEFAULT '',   -- describe: short | detailed
    input_hash  TEXT NOT NULL,
    output      TEXT NOT NULL,
    source      TEXT NOT NULL CHECK (source IN ('auto', 'teacher')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (kind, lang, variant, input_hash)
);

-- AI output that failed the automatic checks. Learners see safe_output (the
-- original text, or only the agreed details) until a teacher decides.
CREATE TABLE review_items (
    id           BIGSERIAL PRIMARY KEY,
    kind         TEXT NOT NULL,
    lang         TEXT NOT NULL,
    variant      TEXT NOT NULL DEFAULT '',
    input_hash   TEXT NOT NULL,
    input_text   TEXT NOT NULL DEFAULT '',
    input_image  TEXT NOT NULL DEFAULT '',
    ai_output    TEXT NOT NULL,
    safe_output  TEXT NOT NULL,
    issues       JSONB NOT NULL DEFAULT '[]',
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    final_output TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX review_items_one_open ON review_items (kind, lang, variant, input_hash) WHERE status = 'pending';
CREATE INDEX review_items_status_idx ON review_items (status, created_at);

-- N1 comprehension-driven adaptation -------------------------------------

-- Anonymous learners: a code, a starting profile and a language.
CREATE TABLE learners (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    profile     TEXT NOT NULL,
    lang        TEXT NOT NULL DEFAULT 'en',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A lesson cut into short chunks, each with one comprehension question.
CREATE TABLE lesson_chunks (
    lesson_id   BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    lang        TEXT NOT NULL,
    idx         INT NOT NULL,
    text        TEXT NOT NULL,
    question    JSONB NOT NULL,
    PRIMARY KEY (lesson_id, lang, idx)
);

-- One shown chunk: which support mix the learner got and whether they
-- answered its question correctly (NULL until answered).
CREATE TABLE attempts (
    id           BIGSERIAL PRIMARY KEY,
    learner_id   BIGINT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    lesson_id    BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    chunk_idx    INT NOT NULL,
    mix          TEXT NOT NULL,
    reason       TEXT NOT NULL,
    correct      BOOLEAN,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    answered_at  TIMESTAMPTZ
);
CREATE INDEX attempts_learner_idx ON attempts (learner_id);
