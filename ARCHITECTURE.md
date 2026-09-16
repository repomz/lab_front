# Frontend architecture

The Expo application uses a feature-oriented structure. The root `App.tsx` is only the Expo entry point; application composition lives in `src/application/App.tsx`.

## Dependency direction

- `src/application` composes screens and owns session/navigation state.
- `src/features/*` owns domain UI and domain-specific behavior.
- `src/components` contains reusable, domain-neutral UI and platform adapters.
- `src/navigation` owns navigation contracts and navigation chrome.
- `src/api.ts` and `src/types.ts` are the shared backend boundary.
- `src/theme.ts`, `src/styles.ts`, and `src/config.ts` contain shared presentation and configuration primitives.
- `src/utils` contains platform-neutral or narrowly scoped helpers.

Feature modules must not import the application composition root. Shared behavior used by multiple features belongs in `components`, `utils`, or a dedicated shared feature utility (for example `features/articles/utils.ts`). API calls remain behind `api.ts`, and backend DTOs remain in `types.ts`.

## Feature map

- `auth` — login, registration, and PIN entry.
- `analyses` — list/dynamics, upload/recognition, details, and reports.
- OCR upload returns immediately; `application/App.tsx` polls only while queued jobs exist, updates progress cards, and exposes completion through an actionable in-app notification.
- `ai` — AI conversations.
- `chat` — doctor and support conversations.
- `clinic` — doctors, appointments, schedules, patients, and article management.
- `home` and `health` — dashboards and educational content.
- `profile` — profile editing, completion, and account deletion flows.

## Responsive web breakpoints

- `< 640 px` — compact mobile layout and bottom navigation.
- `640–959 px` — tablet layout.
- `≥ 960 px` — desktop shell with sidebar.
- `≥ 1600 px` — wide dashboard: home media and analysis/dynamics cards use two columns with bounded readable widths.
- `≥ 1800 px` — large-screen authentication composition grows to a 1480 px canvas with scaled typography and actions.

Content remains centered and bounded on 2560 px and ultrawide displays; backgrounds continue full bleed. New desktop styles must be checked at 1366×768, 1440×900, 1920×1080, 2560×1440, and 3440×1440 in addition to the mobile PWA matrix.

Run `pnpm typecheck` and `pnpm build` before publishing. The production build includes the PWA invariant verifier.
