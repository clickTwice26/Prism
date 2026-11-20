-- Sign templates Prism wrote down from approved community clips (the sign's
-- parts: handshape, place, direction, movement), so signs the corpus lacks can
-- be recognised. A description, not a recording. Deleted with its clip, and
-- removed when the clip is rejected or withdrawn.
CREATE TABLE sign_derived (
    video_id    BIGINT PRIMARY KEY REFERENCES sign_videos(id) ON DELETE CASCADE,
    term_id     BIGINT NOT NULL REFERENCES sign_terms(id) ON DELETE CASCADE,
    template    JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sign_derived_term_idx ON sign_derived (term_id);
