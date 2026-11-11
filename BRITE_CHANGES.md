# Brite changes to Documenso

This fork (`hd-brite/documenso`) carries a small set of Brite-specific changes on top of
upstream [documenso/documenso](https://github.com/documenso/documenso). This file is the
authoritative list of every divergence. **Any PR that changes fork behavior away from
upstream MUST update this file in the same PR.**

Deployment lives in the Brite monorepo under `tools/documenso/` (Kustomize + ArgoCD,
digest-pinned images). See that README for infrastructure details.

## Upstream base

- Current base: upstream `main` at `562d78e2d7f20db0f1d5dc63375379b3af0d07c5` ("feat: add granular signin disable flags and OIDC auto-redirect (#2857)", pre-v2.14.0 line).
- To take a new upstream version: merge the upstream tag/branch into `main` via PR (prefer merge over rebase since `main` is shared), re-verify each change below survived, then publish a new image.

## Publishing images

- CI: `.github/workflows/publish_brite_documenso.yml`
- Trigger: push a tag matching `v*-brite.*` (e.g. `v2.14.0-brite.3`) or run the workflow manually with the tag to stamp.
- Images push to both Brite ACRs with immutable tags (`<tag>` and `<tag>-<shortsha>`). The monorepo `tools/documenso/` deployment pins the image by digest- bump it there after publishing.

## Changes from out-of-the-box Documenso

### 1. Brite ACR publish workflow (RDIS-310 / RLN-64, PR #1)

- `.github/workflows/publish_brite_documenso.yml` (new file, no upstream code touched).
- Builds the fork image and pushes it to the Brite dev and prod ACRs with immutable tags so deployments can pin digests.

### 2. Brite branding (RDIS-325 / RLN-20, PR #2, shipped as `v2.14.0-brite.2`)

- Replaced Documenso logos, favicons and touch icons with Brite assets:
  `packages/assets/` (logo.png, logo_icon.png, favicons, static/logo.png),
  `apps/remix/public/` (favicons, android-chrome + apple-touch icons, static/logo.png),
  `packages/email/static/logo.png`.
- `apps/remix/public/site.webmanifest`: Brite app name.
- `apps/remix/app/components/general/branding-logo.tsx` and `branding-logo-icon.tsx`: render the Brite PNG assets instead of the inline Documenso SVGs.
- `apps/remix/app/components/general/app-nav-mobile.tsx` and `apps/remix/app/routes/_profile+/_layout.tsx`: logo sizing/usage adjustments for the Brite logo.
- `packages/email/template-components/template-branding-logo.tsx` and `packages/email/templates/admin-user-created.tsx`: Brite logo in emails.

### 3. Remove "Go Back Home" on signing pages (RLN-68, PR #3)

- `apps/remix/app/routes/_recipient+/sign.$token+/complete.tsx`: removed the "Go Back Home" button from the post-signing completion page (upstream shows it to any visitor with a logged-in Documenso session) plus the now-dead `returnToHomePath` plumbing.
- `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx`: removed the logged-in "Go Back Home" link from both document-cancelled states. The unauthenticated fallback text is unchanged.
- Rationale: signers should never be offered navigation into the Documenso app shell.

### 4. Configurable reminder stop-after window (RLN-92, PR #4)

- `packages/lib/constants/envelope-reminder.ts`: the previously hard-coded `MAX_REMINDER_WINDOW_DAYS = 30` cutoff (how long automated signing reminders may keep being sent) is now overridable per organisation/team/document via a new optional `stopAfter` field on `ZEnvelopeReminderSettings`, reusing the same amount+unit shape as the existing `sendAfter`/`repeatEvery` fields. Absent `stopAfter` (all settings saved before this change) falls back to the unchanged 30-day default, so existing behavior is unaffected. Added `MAX_REMINDER_PERIOD_DAYS` (10 years) as an absolute ceiling on any `sendAfter`/`repeatEvery`/`stopAfter` period, since an unbounded `amount` could otherwise overflow `Date` arithmetic and silently defeat the cap. Added `isStopAfterAtLeastSendAfter` (shared by the schema's `superRefine` and the picker's inline warning) enforcing `stopAfter >= sendAfter`.
- `packages/ui/components/document/reminder-settings-picker.tsx`: added a third "Stop sending reminders after" control mirroring the existing two, always required (no unlimited/disabled option). No changes needed to the org/team defaults form, the per-document override dialog, or any tRPC router - all three already treat `reminderSettings` as an opaque whole object.
- `packages/app-tests/e2e/envelope-editor-v2/envelope-settings.spec.ts`: extended to set/verify the new field.
- Rationale: the reminder cap existed to prevent nagging a recipient forever, but was rigid; this makes the cutoff configurable at the same level as the existing reminder timing settings, per Brite product direction.

### 5. E2E runner switched to `ubuntu-latest` (RLN-95, PR #5)

- `.github/workflows/e2e-tests.yml`: `runs-on` changed from `warp-ubuntu-2204-x64-8x` to `ubuntu-latest`.
- Rationale: `warp-ubuntu-2204-x64-8x` is a third-party WarpBuild custom runner label inherited unchanged from upstream. Every E2E run on this repo sat `queued` indefinitely and was never actually executed (confirmed via run history back to 2026-07-01) - no WarpBuild runner with that label is reachable from this fork. Note `.github/workflows/publish.yml` (upstream's original Docker publish workflow, distinct from Brite's own `publish_brite_documenso.yml`) also references WarpBuild runners (`warp-ubuntu-latest-x64-4x`/`arm64-4x`), but that workflow has never run in this fork either - it only triggers on push to a `release` branch, which doesn't exist here (only `main` and feature branches). So this isn't "Brite has a working WarpBuild integration elsewhere" - it's a second, differently-masked instance of the same inherited-but-never-verified dependency. Switching E2E to `ubuntu-latest`, the runner every workflow that has actually executed in this fork uses, lets the suite run; confirmed passing end-to-end in ~55 minutes.
- `packages/app-tests/visual-regression/field-meta-pdf-1.png`: this is the first time E2E has ever completed on this repo, and it surfaced a genuinely stale reference image - the "Signature Tests" page baseline still showed upstream Documenso's original black-outline logo mark used as this fixture's demo signature image (`packages/assets/logo_icon.png`), even though that file was replaced with Brite's orange icon back in the branding change (#2) - the baseline was simply never regenerated since E2E never ran to catch it. Verified the new baseline renders byte-identical (zero differing pixels) across 5 separate runs before committing it. Not a rendering/environment bug - traced to the actual source asset and confirmed via an independent third-party PDF renderer (poppler). The other two comparisons that showed large diffs in the first run (`alignment-pdf-3`, `field-meta-7`) are the certificate page, which this test intentionally compares against a blank placeholder and expects a large diff (`> 20000`) - both already passed correctly and needed no change.

### 6. Brite orange primary color (SS-34)

- Replaced upstream Documenso's lime green primary (`#A2E771`) with the orange from the Brite logo (`#F37021`, sampled from `packages/assets/logo.png`). Only token values changed - no class names - to keep upstream merges small.
- `packages/ui/styles/theme.css`: `--primary`, `--primary-foreground`, `--ring`, `--field-card`, `--field-card-border`, `--card-border-tint` and the `--new-primary-*` scale in light mode; `--primary`, `--primary-foreground`, `--secondary-foreground`, `--accent-foreground`, `--ring` and `--card-border-tint` in dark mode. `--primary-foreground` stays a near-black of the same hue (5.8:1 on the orange, WCAG AA); white text on this orange is only 2.9:1.
- `packages/tailwind-config/index.cjs`: the `documenso` color scale (`text-documenso-700` links, `bg-documenso` accents, `bg-documenso-200` filled fields, loaders, dropzone hover) is now an orange scale built around `#F37021` at 500. `documenso-700` (`#B4470A`) is 5.5:1 on white, up from 2.2:1 for the old green.
- `packages/lib/constants/theme.ts`: `DEFAULT_BRAND_COLORS` hex mirror updated to match (`primary`, `primaryForeground`, `ring`, `fieldCard`, `fieldCardBorder`). This also recolors email templates, which read these defaults, and the branding color-picker defaults.
- `packages/email/preview/app/components/playground.tsx`: email preview defaults updated to match (dev tool only).
- Not changed: recipient identity colors (`--recipient-green` etc.), semantic success/warning/error colors, and the `apps/docs` site.
- Rationale: match the Brite branding shipped in change 2.

### 7. Per-envelope sender name in recipient emails (BL-3903)

- New nullable column `DocumentMeta.senderName` (`packages/prisma/schema.prisma`, migration `20261109140858_add_document_meta_sender_name`, additive `ADD COLUMN ... TEXT`, no backfill). Accepted on envelope create/update as `meta.senderName` (`ZDocumentMetaCreateSchema`, trimmed, max 100) and stored by `extractDerivedDocumentMeta`. An older image strips the unknown key, so callers can send it before this image is deployed.
- **Team allowlist (security):** the name is only used for teams listed in the new env `NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS` (comma-separated team ids, `packages/tsconfig/process-env.d.ts`). Unset means no team. Every SSO user gets a personal team, so without the allowlist anyone could choose the From name of mail sent from our domain.
- `packages/lib/utils/envelope-sender.ts` (new): `isSenderNameAllowedForTeam`, `getEnvelopeSenderName` (drops format characters such as bidi overrides and zero-width spaces but keeps the zero-width joiner and non-joiner some names need, collapses control characters and whitespace, blank means unset), `withEnvelopeSenderName` (swaps only the display name) and `getSenderInviteText` (subject + default message).
- `packages/lib/server-only/email/get-email-context.ts`: for `RECIPIENT` emails of an allowed team, the From display name becomes the envelope sender name. This covers every `RECIPIENT`-type email of that envelope (invite, resend, reminder, completed, cancelled, rejected, expired, including the copies to the owner). The From address is unchanged (instance SMTP or organisation email), so SPF/DKIM/DMARC keep passing. Replies go to `meta.emailReplyTo`, which callers set to the sender's real address.
- `packages/email/templates/document-invite.tsx` and `template-components/template-document-invite.tsx`: new optional `senderName` prop. When set (and the recipient is not the self-signer) the heading, preview and default body say "<senderName> has invited you to sign "<document>"" instead of "<API token owner> on behalf of "<team>"", and the PERSONAL-organisation "<owner> (<owner email>)" line is hidden.
- `send-signing-email.handler.ts`, `resend-document.ts` and `process-signing-reminder.handler.ts`: when the envelope has an allowed sender name, the subject is "<senderName> has invited you to sign <document>" (resends and reminders prefix "Reminder: ") and the default message names the sender. A custom `meta.subject` / `meta.message` still wins.
- `packages/lib/vitest.config.ts`: adds the Babel macros plugin and the automatic JSX runtime so tests can render email templates (Lingui macros). Needs Node 22 like the rest of the repo. Tests: `utils/envelope-sender.test.ts`, `utils/envelope-sender-email.test.tsx`, `types/document-meta.test.ts`, `server-only/email/get-email-context.test.ts` (wiring, with a mocked Prisma).
- Rationale: RLN signing emails must look like they come from the consultant who sent them, not from the Documenso user that owns the API token ("Scott Johnson on behalf of 'RLN Documents'"). Envelopes without `senderName`, and teams not in the allowlist (Brite Sales, personal teams), keep upstream behavior. New strings have no translations yet, so non-English emails fall back to English for these lines.

### 8. CI runners pinned to `ubuntu-24.04` (BL-3903)

- `.github/workflows/ci.yml`, `e2e-tests.yml` and `codeql-analysis.yml`: `runs-on: ubuntu-24.04` instead of `ubuntu-latest`.
- Rationale: GitHub moved `ubuntu-latest` to Ubuntu 26.04 after the last green run (2026-09-30). Playwright 1.56.1 (pinned in `package.json`) refuses to install Chromium there ("Playwright does not support chromium on ubuntu26.04-x64"), so `npm ci` failed in Build App, E2E Tests and CodeQL on every PR. `publish_brite_documenso.yml` builds inside Docker and is unaffected, so it stays on `ubuntu-latest`. Unpin when Playwright is upgraded to a version that supports 26.04.
