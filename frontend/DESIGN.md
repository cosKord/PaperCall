# PaperCall interface direction

PaperCall uses a retro-arcade visual language for its student and admin workflows. The supplied reference is the visual source of truth.

## Visual system

- Warm ivory page background, white content panels, near-black text, and near-black outlines.
- Square panels with a consistent hard offset shadow. Keep the outline and shadow visually crisp instead of using soft elevation.
- Heavy sans-serif page and card headings. Use compact monospaced uppercase labels for statuses, schedules, and small metadata.
- Use lime for balances and primary actions, and violet or saturated branch colors for secondary emphasis.
- The Hit pool uses a blue-to-mint gradient; the Miss pool uses an orange-to-magenta gradient. Keep labels legible over both gradients.
- Avoid large decorative illustrations and unnecessary icons in branch cards.

## Component and layout rules

- Implement page styling in TSX with Tailwind utility classes. Do not add page-specific CSS files.
- Reuse the shared dashboard header, leaderboard, pool distribution, schedule, payout estimate, and subject components.
- Keep the leaderboard in the right rail beside the room grid on desktop; place it after the grid on narrow screens.
- Keep student actions focused on reading pool distribution, estimating a proposed stake, and placing a call. Keep admin publishing, locking, and settlement actions distinct.
- Preserve keyboard focus visibility, semantic labels, loading, empty, error, and disabled states.
- Use short left/right page transitions to indicate forward/back navigation; use a quiet crossfade for untyped navigation. Reduced-motion users get a short opacity-only reveal.
- Keep motion brief and functional, and honor reduced-motion preferences.

## Implementation notes

The palette, route transition keyframes, and base behavior live in `app/globals.css`; page and component details live alongside their TSX markup. No new stylesheet is required for this direction.
