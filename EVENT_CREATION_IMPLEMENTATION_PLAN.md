# Sound It event creation implementation plan

## Repository findings
- Mobile app is a Capacitor wrapper around the React/Vite app, not a separate React Native codebase.
- Event creation is app/src/pages/organizer/CreateEvent.tsx; edits use EditEvent.tsx; the same components also serve the web experience.
- Event API is api/events.py, payloads are in schemas.py, and persistence is Event in models.py. Existing event_type and tags cover categories/genres.
- Ticket tiers and China WeChat/Alipay QR payment setup are separate existing flows and must remain unchanged for existing events. Current create form always requires at least one tier and capacity.
- Flyer and gallery files currently upload through /media/upload to platform storage. No Google Drive integration, event invite records, or visibility model was found.
- The desktop checkout already contains extensive uncommitted work (617 changed/untracked paths, including the event UI, API models/schemas, and tests). Preserve it; do not reset, stage, or overwrite broadly.

## Increment 1: mobile-first event setup
- Rework the shared create form responsively for portrait screens: one-column layout at phone widths, accessible category cards/select controls, compact sections, full-width inputs, sticky bottom Save Draft/Publish actions with safe-area and scroll padding. Retain the wider web layout at desktop breakpoints.
- Keep event_type as the selected event category and use existing tags for genres; do not add duplicate category storage without a product need.
- Add visibility choices: public, link-only, invite-only. Add independent attendance mode choices: ticket sales, RSVP, or both. RSVP-only must not require ticket tiers; ticketed events keep existing tier creation and China payment flows.

## Increment 2: compatible API and database
- Add nullable/defaulted event fields and an additive migration for visibility, RSVP enablement, and category only if category administration cannot use existing event_type values. Backfill existing rows as public and preserve existing tickets/status/payment values.
- Update create/update/list/detail payloads and validation. Public discovery excludes link-only and invite-only events; direct links follow explicit access rules. Keep existing event routes and response fields backward-compatible.
- Add authorization checks for invite-only access and RSVP endpoints; do not rely on client-side visibility controls.

## Increment 3: invitations and RSVP
- Add event invitation/guest records, organizer-owned invitation endpoints, invitation status, and RSVP responses. For invite-only events, require authenticated invite acceptance or a scoped, expiring invitation token. Add rate limits and avoid exposing guest lists publicly.

## Increment 4: shared gallery and Google Drive architecture
- Add event photo metadata and provider abstraction so event/guest permissions and gallery records stay in Sound It while bytes can live in an external provider. Keep current upload path as the default until provider connection is complete.
- Prioritize Google Drive with per-organizer OAuth, least-scope access, encrypted refresh tokens, revocation/disconnect, and checks that guest uploads only reach the event folder. Do not store credentials in app code, local storage, or plaintext database fields. Do not promise direct iCloud Drive folder integration.
- Do not enable Google OAuth or external account operations until client credentials, redirect configuration, encryption key management, and organizer authorization are approved and available.

## Verification
- Add focused tests for default/backward-compatible event serialization, public/link-only/invite-only visibility, RSVP-only creation, ticketed creation, and invite authorization. Run backend tests and the app TypeScript/build check; inspect diffs to ensure no unrelated pre-existing work changed.
- Do not run migrations against production, deploy, or access billing/accounts as part of local implementation.
