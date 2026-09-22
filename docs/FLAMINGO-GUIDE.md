# Here, let me help you

First treatment · September 22, 2026 · A017 · not generated or deployed

## The character

A lanky flamingo with the composure of a hotel concierge who has watched several
civilizations embarrass themselves. Warm, dry, unhurried. No mascot costume, giant
cartoon eyes, aggressive performance or sales pitch. The joke is that this bird
thinks walking you through a television on a beach is perfectly ordinary.

Bone sand, a void-black distant television silhouette, restrained magenta plumage,
copper water and occasional phosphor marks in the wet sand. Use the established
studio palette as art direction, with natural light and believable textures.
The reference isn't a tropical screensaver; it's an impossible place that feels safe.

## A short walk, about 75–90 seconds

| Time | Picture / action | Spoken draft |
| --- | --- | --- |
| 0–5 | After a deliberate help click: black, a soft relay click, beach opens at the viewer's eye level. Flamingo pauses ahead and glances back. | “Oh, good. You made it. Come on. You look like someone who just clicked a television and now has questions.” |
| 5–12 | Bird taps beside its head with a wing, then gestures toward the two choices. The shot holds until chosen. | “First: can you hear me?” |
| Yes branch | Bird leans a little closer, pleased. | “Excellent. The voices are external this time.” |
| Captions branch | Bird nods toward captions without miming a whole conversation. | “No problem. I'll put the voices in writing.” |
| 12–28 | Slow, steady walk resumes. Bird keeps pace beside and slightly ahead of camera, turning its head back. A small channel indicator appears in the sand, not a floating dashboard. | “You're inside Michael MacDonald's studio. It happens to be a television. Swipe up or down, scroll, or use the channel arrows. That's the navigation. You've already survived a remote control. You're qualified.” |
| 28–43 | Bird stops beside two upright shapes in the sand. Brief inserts show actual gallery and instrument-guide content from the site. | “The Gallery holds the paintings. The Program Guide holds the instruments. Open one. Make something. You don't need to understand the machinery to play with the damn thing.” |
| 43–56 | At a shallow pool, the reflection briefly contains a real painting. Bird looks directly at viewer. | “Want an original, a print, or something made just for you? The Gallery and Contact channel get you to Michael. He's the artist. I'm the bird. We've divided the responsibilities.” |
| 56–72 | Warm light reveals a modest gift-shop door standing alone farther down the beach. Actual Home Shopping footage plays in its little window. | “And before you escape, Home Shopping leads to the gift shop. Clothes, prints, pleasantly questionable decisions. Have a look.” |
| 72–82 | Bird steps aside. The door/window becomes the visitor's previous television channel. | “Go on. Get curious. If you get lost, I'll be here. I have no fucking appointments.” |

Timings are editorial targets, not a claim that recorded audio exists. Record the
script first; cut scene lengths to the real voice. Keep directional UI labels in
HTML/captions, not baked into generated footage. Do not advertise music, a writing
library, or custom print checkout as live before those routes actually ship.

## How it fits the real site

- Optional “Here, let me help you” entry opens a full-screen guide overlay. Preserve
  current channel, hash, focus and playback state; suspend that channel's audio.
- Use one guide destination alongside CH001 Wait, What? Reuse A014's accessible
  Yes/No sound-check behavior; the flamingo footage would supply the missing gesture.
  Do not silently discard its existing implementation or approved voice assets.
- Sound starts only after the visitor enables it. Captions start on. No can mean
  “quiet please,” not inability to hear; label the options **Sound on / Captions**.
- Playback controls: pause, sound, CC, replay, exit. Escape exits. A clear **Back to
  my channel** action stays visible; ending offers **Explore** and **Watch again**.
- No forced auto-tour on arrival. Ordinary TV gestures resume immediately on exit;
  inside the film, controls/scrolling captions must not accidentally change channels.
- Reduced motion: static beach compositions and cuts instead of forward camera
  travel or power-on flare. Keep the same voice, captions and information.
- Phone: compose the bird in the central safe area, room below its face for captions.
  No handheld camera bob, fast orbit, flicker or full-screen white flash.

## Build order

1. Review this treatment against the current welcome experience and select the voice.
2. Produce a consistent character reference and one 6–8 second beach/turn-back shot.
3. Build the overlay using that real shot, proper controls and the current-channel
   return state. Test keyboard, phone/Fold, muted playback and failed media loading.
4. Record the complete narration, generate matching shots, edit and time captions.
5. Verify the final media and every named destination; preview before promotion.

No media credits spent and no live welcome replacement in this print-room slice.
