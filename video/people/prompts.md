# Photo and video prompts for the Prism Sign promo

These prompts replace the drawn people in the video with photorealistic, documentary-style shots.
They are written for **Gemini** (image generation with reference images, then **Veo** for motion),
but work in any image tool that accepts a reference image (Midjourney `--cref`, ChatGPT images,
Imagen, Kling, Runway).

Everyone here is a **fictional character**. Mitu is a composite based on the newspaper reports in
the film. Every generated shot carries the on-screen tag "Dramatisation · AI-generated", and the
first one carries "Mitu is a composite character based on the reports in this film."

## How to use this file

1. **Make the character sheets first** (section A). Generate each one until you like the face,
   then keep that image. It is the reference for every later shot of that person.
2. **Make the shots** (section B). For each shot, attach the character sheet(s) it names as
   reference images, paste the prompt, and generate 4 options. Pick the best.
3. **Check every image** against the rejection list (section D). Regenerate anything that fails.
4. **Optional motion.** For shots with a Veo prompt, upload the chosen still to Veo as the first
   frame and paste the motion prompt to get a 4–8 s clip. Stills also work: the video adds a slow
   push-in.
5. **Save** each file into `video/people/` with the exact file name given (`.png` or `.jpg` for
   stills, `.mp4` for clips), at least 1920×1080, 16:9. Then tell Claude "photos are in" and it
   will swap them into the video.

## Rules for every prompt

Paste this style block at the end of **every** prompt (it's already in the shot prompts below as
`[STYLE]`):

```text
[STYLE] Photorealistic documentary photograph, shot on a full-frame camera with a 35mm or 50mm
lens, natural light, shallow depth of field, true-to-life Bangladeshi skin tones, subtle film grain,
gentle teal-and-warm colour grade, authentic and unposed, dignified. 16:9 landscape.
No text, no letters, no writing, no logos, no watermarks, no captions.
```

- **Never generate signing.** Image and video models draw handshapes wrong, and deaf viewers will
  notice at once. Hands are at rest, holding a pen, a cup or the edge of a laptop, pointing at a
  screen, raised straight up to answer a question, or out of frame. Never fingers in sign shapes.
- **No readable text.** Models garble Bangla. Boards, screens and posters stay blank or out of
  focus; the video adds the real words and the real Prism screens on top.
- **No talking close-ups.** People look, listen, react and smile; nobody speaks to camera.
- **Dignity.** Ordinary, clean, modest homes and schools. No poverty clichés, no sad expressions
  for effect, no pity framing.

## A. Character sheets (make these first)

### A1 · Mitu, 11 — file `A1-mitu-sheet.png`

```text
Character reference sheet of one 11-year-old Bangladeshi girl, shown three times side by side on a
plain light-grey studio background: front view, three-quarter view, and profile. Same girl in all
three. Warm medium-brown skin, round face, large bright dark-brown eyes, curious and intelligent
expression with a small closed-mouth smile, black hair in two neat braids tied with white ribbons,
a small black hair clip above her left temple. She wears a Bangladeshi government girls' school
uniform: white salwar kameez, a white orna (scarf) folded in a V across the chest, and a navy-blue
cross-body sash belt. Head-and-shoulders framing, soft even studio light.
[STYLE]
```

### A2 · Rahima, 36, Mitu's mother — file `A2-rahima-sheet.png`

```text
Character reference sheet of one 36-year-old Bangladeshi woman, shown three times side by side on a
plain light-grey studio background: front view, three-quarter view, and profile. Same woman in all
three. Warm medium-brown skin, kind tired eyes, gentle determined expression, black hair in a low
bun with a centre parting, a thin gold nose pin, small gold earrings. She wears a muted sage-green
cotton saree with a simple darker green border, the end draped over her left shoulder.
Head-and-shoulders framing, soft even studio light.
[STYLE]
```

### A3 · Mr Karim, 45, science teacher — file `A3-karim-sheet.png`

```text
Character reference sheet of one 45-year-old Bangladeshi male schoolteacher, shown three times side
by side on a plain light-grey studio background: front view, three-quarter view, and profile. Same
man in all three. Medium-brown skin, short neatly combed black hair greying at the temples, trimmed
moustache, kind but busy expression, reading glasses tucked in his shirt pocket. White short-sleeved
cotton shirt, grey trousers, a faint smudge of chalk dust on his fingers. Head-and-shoulders
framing, soft even studio light.
[STYLE]
```

### A4 · Nusrat, 30, BdSL interpreter (optional) — file `A4-nusrat-sheet.png`

```text
Character reference sheet of one 30-year-old Bangladeshi woman, shown three times side by side on a
plain mid-grey background: front view, three-quarter view, and profile. Same woman in all three.
Medium-brown skin, calm confident expression, black hair tied back neatly, small stud earrings,
plain long-sleeved dark navy top with no pattern (the clothing sign interpreters wear on camera).
Head-and-shoulders framing, soft studio light.
[STYLE]
```

### A5 · Rafiq, 45, deaf reviewer (optional) — file `A5-rafiq-sheet.png`

```text
Character reference sheet of one 45-year-old Bangladeshi man, shown three times side by side on a
plain light-grey background: front view, three-quarter view, and profile. Same man in all three.
Medium-brown skin, neat short black beard with a little grey, short hair, thoughtful, confident and
warm expression, light-blue cotton panjabi with a small collar. Head-and-shoulders framing, soft
studio light.
[STYLE]
```

## B. Shots, in film order

Each shot lists where it goes in the video, the references to attach, the image prompt and an
optional Veo motion prompt.

### S01 · Classroom, wide — `S01-classroom-wide.png` · 0:00–0:02, also the blurred background for 0:08–0:30

References: A3 (Mr Karim), A1 (Mitu).

```text
Wide eye-level shot of a government secondary school classroom in a district town in Bangladesh,
morning. About 30 children in white school uniforms (girls in white salwar kameez with white orna
and navy-blue sash belts, boys in white shirts and navy trousers) sit on long wooden double benches
with attached desks, facing a green chalkboard. Mr Karim, the teacher from the reference, stands at
the board on the left writing with chalk, his back half-turned. Ceiling fans, whitewashed walls with
a faded blue lower band, tall barred windows on the right letting in warm slanting sunlight with
dust in the light. Mitu, the girl from the reference, sits in the second row, slightly right of
centre, clearly visible. The chalkboard has only soft chalk smudges, no readable writing.
[STYLE]
```

Veo (6 s): `Slow, steady dolly forward down the aisle toward the second row. The teacher keeps writing on the board, ceiling fans turn slowly, dust drifts in the sunbeams, children glance at their notebooks. No one speaks to camera. Calm, natural movement.`

### S02 · Teacher at the board — `S02-teacher-board.png` · 0:02–0:04

References: A3.

```text
Medium close-up of Mr Karim, the teacher from the reference, at a green chalkboard in a Bangladeshi
classroom, turning slightly from the board toward the class mid-explanation, chalk in his right hand,
warm morning window light from the right, chalk dust catching the light. The board behind him is out
of focus with soft chalk marks and no readable text. Engaged, kind, a little rushed.
[STYLE]
```

Veo (4 s): `He finishes a chalk stroke, turns his head toward the class and gestures gently with the chalk while explaining. Chalk dust floats in the light. Natural, subtle movement.`

### S03 · Mitu, close — `S03-mitu-close.png` · 0:04–0:08 (lower third "Mitu, 11 · Class 6 · deaf from birth")

References: A1.

```text
Close-up of Mitu, the girl from the reference, sitting at her wooden desk in the second row of a
sunlit Bangladeshi classroom, looking up at the board with an attentive but lost expression,
eyebrows slightly drawn together, pencil resting in her hand above an open notebook. Classmates
around her are soft and out of focus. Warm window light on one side of her face. She is thoughtful,
not sad.
[STYLE]
```

Veo (5 s): `Very slow push-in on her face. She looks from the board down to her notebook and back up, blinking, trying to follow. The classroom behind her stays soft and gently busy. No talking.`

### S04 · Mitu's notebook — `S04-notebook.png` · insert, 0:06–0:08

References: A1 (for the uniform sleeve and hands only).

```text
Overhead close-up of a child's open ruled exercise notebook on a worn wooden school desk, a pencil
in a small hand in a white school-uniform sleeve resting beside it. The page has neat but
unreadable pencil lines and, in the margin, a short column of small hand-drawn question marks.
Soft warm window light, shallow depth of field.
[STYLE]
```

(Question marks are the only marks allowed. If the model writes letters, regenerate.)

### S05 · After school, the veranda — `S05-veranda.png` · problem section cutaway, 0:20–0:22

References: A1, A2.

```text
Late afternoon on the small veranda of a modest, clean concrete home in a Bangladeshi town, a
potted plant and a blue plastic chair. Rahima, the mother from the reference, kneels to Mitu's eye
level and speaks to her gently; Mitu, still in school uniform with her school bag on one shoulder,
watches her mother's face closely, trying to understand. Both hands of each person are relaxed and
low or holding the bag strap. Golden light, soft shadows, a feeling of love with a gap in
communication.
[STYLE]
```

### S06 · Evening, opening Prism — `S06-home-laptop.png` · 0:30–0:42 (behind "Meet Prism Sign") and 1:21–1:24 (Sign words)

References: A1, A2.

```text
Evening inside a modest, tidy Bangladeshi home. Rahima, the mother from the reference, and Mitu sit
side by side at a small wooden table with a laptop open in front of them, lit by a warm table lamp
and the soft glow of the screen on their faces. The laptop is seen from behind or at an angle so
the screen is not visible. Rahima's hand rests on the laptop trackpad; Mitu leans in toward the
screen with a first, delighted smile; her hands rest on the table. A steel glass of water and a
schoolbook on the table. Intimate, warm, hopeful.
[STYLE]
```

Veo (6 s): `Slow arc around the table. Mitu leans closer to the screen and breaks into a smile, then looks up at her mother, who smiles back. Hands stay on the table and the trackpad. Lamp light flickers softly.`

### S07 · Interpreter in her studio (optional) — `S07-nusrat-studio.png` · Live class, 1:46–2:00

References: A4.

```text
Nusrat, the interpreter from the reference, in a small home recording corner: a plain mid-grey
backdrop, a ring light, a laptop on a stand and a webcam. She sits upright, looking at the laptop
screen with focused attention, hands resting together in her lap, about to begin. Shot from the
side so we see her, the ring light and the backdrop. Calm, professional.
[STYLE]
```

(Do not animate her hands. If you film a real BdSL interpreter instead, use that footage here.)

### S08 · The deaf reviewer (optional) — `S08-rafiq-review.png` · AI approach, 2:20–2:30

References: A5.

```text
Rafiq, the man from the reference, sits at a desk in a bright small office of a Bangladeshi deaf
community organisation, reviewing a video on his laptop with careful attention, one hand on the
trackpad and the other holding a pen over a notebook. The laptop screen faces away from the camera.
A shelf with files behind him, soft daylight. Thoughtful, expert, respected.
[STYLE]
```

Veo (4 s): `He watches the screen closely, nods once with quiet approval, and clicks the trackpad. Subtle, natural movement.`

### S09 · Weeks later, Mitu answers — `S09-mitu-raises-hand.png` · close, 2:45–2:53

References: A1, A3.

```text
The same Bangladeshi classroom as before, now in full warm golden morning light. Mitu, the girl
from the reference, sits in the second row with a small tablet propped on her desk (screen angled
away, not visible), and raises her right hand straight up with a bright, confident smile to answer
a question. In the soft background, Mr Karim, the teacher from the reference, turns from the board
toward her with a pleased smile. Classmates look toward her. Joyful, proud, natural.
[STYLE]
```

Veo (5 s): `Mitu raises her hand high with growing confidence and a big smile; the teacher turns toward her and smiles. Gentle push-in. Hand straight up only, no other hand shapes.`

### S10 · Mitu and Rahima, together — `S10-together.png` · final shot before the end card, 2:53–2:57, and the thumbnail

References: A1, A2.

```text
Dusk on the same small veranda of the Bangladeshi home, warm golden light. Mitu and her mother
Rahima sit close together on the veranda step, laughing together, foreheads nearly touching,
Rahima's arm around Mitu's shoulders, Mitu's hands resting in her lap. Pure warmth and connection.
Leave calm open space on the left third of the frame for a title.
[STYLE]
```

Veo (4 s): `They laugh together and Mitu leans her head on her mother's shoulder. Slow, gentle push-in. Soft evening breeze moves the saree edge.`

## C. Thumbnail

Use **S10** (it leaves room on the left for the title). If you want a separate one, generate S10
again at 1280×720 with "Leave the left 45% of the frame calm and darker for a large white title."

## D. Reject and regenerate if

- A face doesn't match its character sheet (compare side by side).
- Any hand has extra, missing or melted fingers, or fingers in a sign shape.
- Any letters, numbers or Bangla text appear (boards, notebooks, screens, posters, clothes).
- The uniform changes (it must be white salwar kameez, white orna and a navy sash belt for girls;
  white shirt and navy trousers for boys).
- A laptop or tablet screen is visible face-on (the video adds the real Prism screens).
- The setting looks non-Bangladeshi (Western classroom, carpets, lockers) or like a poverty cliché.
- Anyone looks sad for effect, or a child is shown in a way that isn't dignified.

## E. Shot list summary

| File | Time in video | Replaces | Needed? |
| --- | --- | --- | --- |
| A1–A3 sheets | references only | | Yes |
| A4, A5 sheets | references only | | Only for S07, S08 |
| S01-classroom-wide | 0:00–0:02, background 0:08–0:30 | Drawn classroom | Yes |
| S02-teacher-board | 0:02–0:04 | Drawn teacher | Yes |
| S03-mitu-close | 0:04–0:08 | Drawn Mitu push-in | Yes |
| S04-notebook | 0:06–0:08 | (new insert) | Nice to have |
| S05-veranda | 0:20–0:22 | (new cutaway) | Nice to have |
| S06-home-laptop | 0:30–0:42, 1:21–1:24 | Drawn parent at home | Yes |
| S07-nusrat-studio | 1:46–2:00 | (new cutaway) | Optional |
| S08-rafiq-review | 2:20–2:30 | (new cutaway) | Optional |
| S09-mitu-raises-hand | 2:45–2:53 | Drawn closing classroom | Yes |
| S10-together | 2:53–2:57, thumbnail | (new) | Yes |
