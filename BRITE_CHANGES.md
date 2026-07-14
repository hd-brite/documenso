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
