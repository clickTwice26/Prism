-- Recorded practice samples for sign recognition: hand skeleton points only,
-- never video. Used to test the recogniser and train the handshape and letter
-- models (docs/sign-recognition-plan.md). Each sample needs the signer's consent
-- and can be withdrawn (deleted).
CREATE TABLE sign_samples (
    id          BIGSERIAL PRIMARY KEY,
    kind        TEXT NOT NULL CHECK (kind IN ('letter', 'handshape', 'word')),
    label       TEXT NOT NULL,              -- e.g. ক, flathand, জ্বর
    signer      TEXT NOT NULL,
    dominant    TEXT NOT NULL DEFAULT 'right' CHECK (dominant IN ('right', 'left')),
    deaf        BOOLEAN NOT NULL DEFAULT false, -- recorded by a deaf signer
    consent_at  TIMESTAMPTZ NOT NULL,
    frames      JSONB NOT NULL,             -- [{t, hands: [{side, points: [[x,y,z] ×21]}]}]
    features    JSONB NOT NULL DEFAULT '[]', -- feature vector per frame, from the browser
    feature_version INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sign_samples_label_idx ON sign_samples (kind, label);
