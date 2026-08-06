# Visual fidelity ledger

Concept reference: `docs/design-concept.png`.

| Comparison point | Concept | Current implementation | Decision |
|---|---|---|---|
| Sidebar | Deep ink-blue rail with exactly two modes and count badges | Same structure, active rail uses coral accent | Kept |
| First viewport | Progress line, serif question title, four answer rows | Same hierarchy, text rendered code-native from verified JSON | Kept |
| Result panel | Dedicated right-side result/guidance region | Guidance state is shown before submit; correct/wrong state appears after submit | Intentional state split for the real workflow |
| Palette | Warm white, navy, coral, mint semantic state | Same tokens in `styles.css` | Kept |
| Completion state | Large empty/review-complete message | `Bạn không còn câu nào cần ôn` with return action | Kept |
| Responsive continuation | Sidebar compresses on narrow screens | Mobile mode switch replaces sidebar at 880px | Intentional responsive adaptation |

Browser evidence: local browser DOM and desktop/mobile screenshot inspection on 2026-08-05. E2E also covers the workflow at Chromium desktop and 390x844 mobile viewport.
