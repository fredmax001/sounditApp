# Sound It — Full Notifications Implementation

Status of the cross-platform notification spec (prompt: 全平台通知功能开发Prompt.md).

## ✅ Implemented — PWA / Web (works in installed PWA, Chrome/Edge/Firefox desktop & Android)

| Spec item | Where |
|---|---|
| `requestPermission()` at the right moment (user gesture, on the settings toggle — never at launch) | `app/src/lib/notificationService.ts` (`enablePush`) |
| Denied → in-app hint pointing to browser/site settings | `openSettingsHint()`, toast from Notification Settings |
| `subscribe()` — VAPID `pushManager.subscribe` + backend registration | `notificationService.ts` + `POST /api/v1/notifications/push-subscribe` |
| `unsubscribe()` / `cancelAll` per device | `POST /api/v1/notifications/push-unsubscribe`, toggle-off in Settings |
| SW `push` handler: icon, badge, image, `tag` grouping, `renotify`, `vibrate`, action buttons, `data.url` deep-link | `app/public/service-worker.js` |
| `notificationclick` → focus existing window or `openWindow` (cold start included), action routing, badge clear | service-worker.js |
| `pushsubscriptionchange` → re-subscribe and notify app | service-worker.js (`PUSH_SUBSCRIPTION_CHANGE` message) |
| Badging API `setBadge` / `clearBadge` + clear-on-seen helper | `notificationService.ts` |
| Server push trigger: ticket approved / rejected / order created → Web Push to buyer's devices (non-blocking) | `api/tickets.py::_create_notification` → `services/push_service.py` (pywebpush + VAPID) |
| Admin broadcast → push | `api/admin.py` (existing) |
| Per-user preference gating | `NotificationPreference` (`push_enabled`, categories) — Settings → Notifications |

**Settings path:** Settings → Notification → "Push Notifications" toggle. Turning it on requests
browser permission and subscribes the device; turning it off unsubscribes. The per-category
toggles (bookings/payments/events/…) gate backend delivery per notification type.

### Server payload format (Web Push / VAPID)
```json
{
  "title": "Ticket Approved",
  "body": "Your ticket for 'Neon Nights' is approved. 2 ticket(s).",
  "tag": "ticket-order-42",
  "image": "https://sounditent.com/static/uploads/.../flyer.jpg",
  "url": "/tickets",
  "actions": [{ "action": "view", "title": "View Ticket" }],
  "data": { "notification_id": 123, "category": "ticket_order", "payload": { "order_id": 42 } }
}
```
- `tag` = grouping/collapse key (one notification per order, replaces stale ones)
- `url` = deep-link target used by `notificationclick`
- `image` auto-absolutized by `push_service.py`

### PWA testing guide
1. `npm run build && npm run preview` (or dev) → open in Chrome → install PWA (or keep tab open).
2. Log in → Settings → Notification → Push Notifications ON → allow permission.
3. Trigger: create a ticket order as a buyer, approve it as the organizer (dashboard) → push arrives.
4. DevTools → Application → Service Workers → "Push" button simulates a push; check `notificationclick` focus/openWindow.
5. Killed-state: close all tabs (SW keeps alive ~30s in Chrome for testing); or use DevTools push with the tab closed.
6. Badge: DevTools console → `navigator.setAppBadge(3)`; clears on notification click.

---

## 📋 Native Steps (to execute when building store binaries — needs your accounts)

### iOS (Capacitor app in `app/ios`)
1. `npm install @capacitor/push-notifications @capacitor/local-notifications` in `app/`.
2. Xcode: App target → Signing & Capabilities → **+ Push Notifications**; Background Modes → **Remote notifications**, **Background fetch**.
3. Apple Developer → App ID → enable Push; create APNs Auth Key (.p8).
4. `AppDelegate` + `Capacitor` plugin registration: request auth with `[.alert, .sound, .badge]`; on token → `POST` to backend (`/api/v1/notifications/device-tokens`, store APNs token with `platform: 'ios'`).
5. Local: `@capacitor/local-notifications` `schedule()` for event reminders (one-shot + daily/weekly repeats); action buttons via `ActionType`; badge via `Capacitor.Plugins.Badge` (cleared on app active).
6. Server: send via APNs HTTP/2 (`.p8` key) — payload: `aps.alert.{title,body}`, `sound`, `badge`, `thread-id` (grouping), `mutable-content: 1` (for the Notification Service Extension rich-image target), custom `deepLink` field.
7. Info.plist: none extra beyond capabilities; provision with production APNs for TestFlight/App Store.

### Android (Capacitor app in `app/android`)
1. `npm install @capacitor/push-notifications @capacitor/local-notifications`.
2. Firebase console → create project → add Android app (package id from `app/android/app/build.gradle`) → download `google-services.json` into `app/android/app/`.
3. `android/build.gradle` + `app/build.gradle`: apply `com.google.gms.google-services` plugin; add `com.google.firebase:firebase-messaging`.
4. AndroidManifest: `POST_NOTIFICATIONS` (API 33+), `INTERNET`; `CapacitorPushNotifications` service handles `onNewToken` → upload to backend (`platform: 'android'`).
5. Channels (API 26+): create in plugin init — "general" (default), "reminders" (high), "messages" (high, vibration).
6. Runtime permission: request `POST_NOTIFICATIONS` on first relevant action (same UX rule as PWA); denial → settings intent (`ACTION_APP_NOTIFICATION_SETTINGS`).
7. Scheduling: local notifications for reminders; FCM data messages with `channel_id`, `image`, `deepLink` for server pushes; high priority for time-sensitive.
8. Tap routing: launcher Activity reads intent extras → `deepLink`; cold start handled in `onCreate`/`onNewIntent`.

### Shared backend addition needed for native
`device_tokens` table (user_id, platform `ios|android`, token, created_at, is_active) + senders:
APNs HTTP/2 via `hyper`/`aioapns` and FCM v1 HTTP via `google-auth`. Both fire-and-forget like
`push_service.py`. VAPID web push already live.

---

## ⚠️ Pitfalls checklist (from the spec)
- **Permission denial** — never re-prompt blindly; show settings deep-link (implemented on PWA).
- **Android battery optimization** — scheduled alarms can be killed; use FCM high-priority for time-sensitive; WorkManager for deferrable.
- **APNs dev vs prod** — device tokens are environment-specific; build/test with the right .p8 environment.
- **Token refresh** — `pushsubscriptionchange` (web, implemented), `onNewToken` (FCM), APNs token can rotate → always re-upload.
- **iOS PWA push** — requires Home-Screen install (iOS 16.4+); otherwise in-app only.
- **Badge drift** — badge increments on push, must clear on tap/seen (implemented in SW + `markSeen()`).
- **Duplicate notifications** — always set a stable `tag`/`thread-id`; `renotify: true` when re-using a tag.
