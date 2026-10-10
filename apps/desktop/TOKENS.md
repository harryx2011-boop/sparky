# Tokens: Sparky Desktop

Source of truth: `../../packages/ui/src/styles.css` (shared theme, imported by `src/renderer/src/index.css`) and `src/renderer/src/index.css` (base sizes). Themes: dark default (`src/renderer/index.html:2`), light and system via settings. Tailwind keys: each `--name` is exposed as `--color-name` and friends (`../../packages/ui/src/styles.css:122-149`).

## Color
| token | value | use | source |
| --- | --- | --- | --- |
| `--background` | `#fafafa` | page ground, light | `../../packages/ui/src/styles.css:61` |
| `--background` | `#0a0a0a` | page ground, dark | `../../packages/ui/src/styles.css:91` |
| `--foreground` | `#111111` | body text, light | `../../packages/ui/src/styles.css:62` |
| `--foreground` | `#ededed` | body text, dark | `../../packages/ui/src/styles.css:92` |
| `--card` | `#ffffff` | card surface, light | `../../packages/ui/src/styles.css:63` |
| `--card` | `#111111` | card surface, dark | `../../packages/ui/src/styles.css:93` |
| `--popover` | `#ffffff` | popover and menu, light | `../../packages/ui/src/styles.css:65` |
| `--popover` | `#141414` | popover and menu, dark | `../../packages/ui/src/styles.css:95` |
| `--primary` | `#111111` | primary fill, light | `../../packages/ui/src/styles.css:67` |
| `--primary` | `#ededed` | primary fill, dark | `../../packages/ui/src/styles.css:97` |
| `--primary-foreground` | `#fafafa` | text on primary, light | `../../packages/ui/src/styles.css:68` |
| `--primary-foreground` | `#0a0a0a` | text on primary, dark | `../../packages/ui/src/styles.css:98` |
| `--secondary` | `#f0f0f0` | secondary fill, light | `../../packages/ui/src/styles.css:69` |
| `--secondary` | `#1a1a1a` | secondary fill, dark | `../../packages/ui/src/styles.css:99` |
| `--muted` | `#f2f2f2` | muted fill, light | `../../packages/ui/src/styles.css:71` |
| `--muted` | `#161616` | muted fill, dark | `../../packages/ui/src/styles.css:101` |
| `--muted-foreground` | `#6b6b6b` | muted text, light | `../../packages/ui/src/styles.css:72` |
| `--muted-foreground` | `#a1a1a1` | muted text, dark | `../../packages/ui/src/styles.css:102` |
| `--subtle-foreground` | `#8a8a8a` | hints and labels, light | `../../packages/ui/src/styles.css:73` |
| `--subtle-foreground` | `#8a8a8a` | hints and labels, dark | `../../packages/ui/src/styles.css:103` |
| `--accent` | `#ececec` | hover fill, light | `../../packages/ui/src/styles.css:74` |
| `--accent` | `#1c1c1c` | hover fill, dark | `../../packages/ui/src/styles.css:104` |
| `--border` | `#e4e4e4` | borders, light | `../../packages/ui/src/styles.css:76` |
| `--border` | `#232323` | borders, dark | `../../packages/ui/src/styles.css:106` |
| `--input` | `#dcdcdc` | input border and scrollbar thumb, light | `../../packages/ui/src/styles.css:77` |
| `--input` | `#2a2a2a` | input border and scrollbar thumb, dark | `../../packages/ui/src/styles.css:107` |
| `--lime` | `#62990f` | the one accent, light | `../../packages/ui/src/styles.css:79` |
| `--lime` | `#b6f04a` | the one accent, dark | `../../packages/ui/src/styles.css:109` |
| `--lime-foreground` | `#111111` | text on lime, light | `../../packages/ui/src/styles.css:80` |
| `--lime-foreground` | `#0a0a0a` | text on lime, dark | `../../packages/ui/src/styles.css:110` |
| `--ring` | `var(--lime)` | focus ring, alias of lime, both themes | `../../packages/ui/src/styles.css:81` |
| `--track` | `#e6e6e6` | bar and slider track, light | `../../packages/ui/src/styles.css:82` |
| `--track` | `#222222` | bar and slider track, dark | `../../packages/ui/src/styles.css:112` |
| `--bar-off` | `#d9d9d9` | unlit Performance bar, light | `../../packages/ui/src/styles.css:83` |
| `--bar-off` | `#2a2a2a` | unlit Performance bar, dark | `../../packages/ui/src/styles.css:113` |
| `--success` | `#16a34a` | success, light | `../../packages/ui/src/styles.css:84` |
| `--success` | `#4ade80` | success, dark | `../../packages/ui/src/styles.css:114` |
| `--destructive` | `#dc2626` | error and destructive, light | `../../packages/ui/src/styles.css:85` |
| `--destructive` | `#f87171` | error and destructive, dark | `../../packages/ui/src/styles.css:115` |
| `--warning` | `#d97706` | warning, light | `../../packages/ui/src/styles.css:86` |
| `--warning` | `#fbbf24` | warning, dark | `../../packages/ui/src/styles.css:116` |
| `.sp-bars[data-level="low"]` | `linear-gradient(180deg, #9fb4c7, #5e7a94, #9fb4c7)` | Performance bars, Low | `../../packages/ui/src/styles.css:193` |
| `.sp-bars[data-level="normal"]` | `linear-gradient(180deg, #8fb8ff, #8b7cf6, #4fa3e8, #8fb8ff)` | Performance bars, Normal | `../../packages/ui/src/styles.css:196` |
| `.sp-bars[data-level="max"]` | `linear-gradient(180deg, #ffd166, #ff7a45, #f0386b, #ffd166)` | Performance bars, Max | `../../packages/ui/src/styles.css:199` |
| `--sp-flow-hi` | `var(--card)` | compression thumb, light | `../../packages/ui/src/styles.css:248` |
| `--sp-flow-hi` | `var(--foreground)` | compression thumb, dark | `../../packages/ui/src/styles.css:255` |
| `--sp-flow-sheen` | `color-mix(in srgb, var(--card) 34%, transparent)` | compression sheen, light | `../../packages/ui/src/styles.css:250` |
| `--sp-flow-sheen` | `color-mix(in srgb, var(--lime-foreground) 14%, transparent)` | compression sheen, dark | `../../packages/ui/src/styles.css:256` |
| `--sp-flow-edge` | `transparent` | compression spark edge, light | `../../packages/ui/src/styles.css:251` |
| `--sp-flow-edge` | `color-mix(in srgb, var(--lime-foreground) 22%, transparent)` | compression spark edge, dark | `../../packages/ui/src/styles.css:257` |

## Type
| token | value | use | source |
| --- | --- | --- | --- |
| `--font-sans` | `"Satoshi", "Satoshi Fallback", "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif` | all UI text | `../../packages/ui/src/styles.css:120` |
| `--font-mono` | `"IBM Plex Mono", "Cascadia Mono", ui-monospace, Consolas, monospace` | labels, counts, queue text | `../../packages/ui/src/styles.css:121` |
| `html font-size` | `14px` | base UI size | `src/renderer/src/index.css:11` |
| `Satoshi Fallback ascent-override` | `101%` | fallback metrics match Satoshi | `../../packages/ui/src/styles.css:37` |

## Radius
| token | value | use | source |
| --- | --- | --- | --- |
| `--radius` | `8px` | base radius | `../../packages/ui/src/styles.css:87` |
| `--radius-sm` | `calc(var(--radius) - 4px)` | `rounded-sm` | `../../packages/ui/src/styles.css:146` |
| `--radius-md` | `calc(var(--radius) - 2px)` | `rounded-md` | `../../packages/ui/src/styles.css:147` |
| `--radius-lg` | `var(--radius)` | `rounded-lg`, buttons and inputs | `../../packages/ui/src/styles.css:148` |
| `--radius-xl` | `calc(var(--radius) + 4px)` | `rounded-xl`, cards and dialogs | `../../packages/ui/src/styles.css:149` |
| `.sp-bar` | `2px` | Performance bar ends | `../../packages/ui/src/styles.css:180` |
| `.sp-flow-track` | `9999px` | compression pill | `../../packages/ui/src/styles.css:264` |

## Shadow
| token | value | use | source |
| --- | --- | --- | --- |
| `.sp-flow-thumb::before` | `0 1px 2px rgb(0 0 0 / 0.16), 0 2px 8px rgb(0 0 0 / 0.14)` | compression thumb, light | `../../packages/ui/src/styles.css:330` |
| `.dark .sp-flow-thumb::before` | `0 1px 2px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.4)` | compression thumb, dark | `../../packages/ui/src/styles.css:334` |
| `.sp-flow-thumb:focus-visible::before` | `0 0 0 4px color-mix(in srgb, var(--ring) 45%, transparent), 0 1px 2px rgb(0 0 0 / 0.16)` | compression thumb focus ring | `../../packages/ui/src/styles.css:346` |

## Motion
| token | value | use | source |
| --- | --- | --- | --- |
| `--sp-flow-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | compression pill and thumb easing | `../../packages/ui/src/styles.css:252` |
| `.sp-flow-range` | `right 180ms var(--sp-flow-ease)` | lime fill follows the thumb | `../../packages/ui/src/styles.css:274` |
| `.sp-flow-thumb::before` | `transform 160ms var(--sp-flow-ease), box-shadow 160ms var(--sp-flow-ease)` | thumb hover and press | `../../packages/ui/src/styles.css:331` |
| `.sp-bar` | `background-color 0.3s ease` | Performance bar colour change | `../../packages/ui/src/styles.css:183` |
| `.sp-bar[data-on]` | `sp-flow 2.2s ease-in-out infinite` | Performance bar flow | `../../packages/ui/src/styles.css:187` |
| `.sp-running` | `sp-pulse 1.6s ease-in-out infinite` | running progress | `../../packages/ui/src/styles.css:210` |
| `.sp-flow-sheen` | `sp-flow-sheen 9s var(--sp-flow-ease) infinite` | compression sheen | `../../packages/ui/src/styles.css:289` |
| reduced motion | `transition-duration: 0.01ms !important` | every transition settles at once | `../../packages/ui/src/styles.css:379` |
