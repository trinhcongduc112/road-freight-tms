---
title: Install the mobile app
sidebar_position: 1
---

# Install the mobile app for drivers

The **Road Freight Driver** app runs on Android (7.0+) and iOS (13.0+). It is the main tool drivers use daily.

:::info Mobile screenshot
This section needs captures from the Android emulator. Will be added later.
:::

## Android installation

### Option 1 — APK file (from admin)

1. Admin sends the `road-freight-driver.apk` file via Zalo/email
2. Driver **downloads** to phone
3. Open the file → Android asks to confirm installing from unknown source
4. Go to **Settings > Security > Allow from this source** → enable
5. Back → tap **"Install"**
6. After installation → open the app

### Option 2 — Google Play Store (once published)

Search "Road Freight Driver" → install like any regular app.

## iOS installation

The app is **not yet public on App Store**. Install via **TestFlight**:

1. Admin adds driver's Apple ID to TestFlight
2. Driver receives invitation email
3. Open email → install TestFlight → accept invitation
4. In TestFlight, tap **"Install"** on Road Freight Driver

## First login

Open app → **Login** screen:

1. Enter **Email** + **Password** provided by admin
2. Tick **"Remember login"** (optional — skip typing next time)
3. Tap **"LOGIN"**

:::tip Where does the account come from?
The company admin (via web) **invites the driver** in **Administration > Users** → driver receives invitation email → sets password → can use.
:::

### Configure backend URL (first time only)

If the login screen shows **"Cannot connect to server"**, the backend URL may not be set. To fix:

1. On the Login screen, tap **"⚙️ Connection settings"** (below the form)
2. Enter the backend URL provided by admin (e.g. `https://tms-company.com/api`)
3. Tap **"Save"**
4. Return and login

The URL is saved permanently — no need to re-enter next time.

## Grant permissions

After login, the app requests 3 **mandatory** permissions:

| Permission | Purpose | If denied |
|---|---|---|
| 📍 **Location (GPS)** — "Always allow" | Updates position during trips | Cannot receive trips |
| 📷 **Camera** | Capture POD + incident photos | Cannot confirm delivery |
| 🔔 **Notifications** | New trips, maintenance schedules | Miss assigned trips |

:::warning Location must be "Always allow"
Android 10+ has 3 levels: "While using" / "Always" / "Deny". Choose **"Always"** so GPS works even when the app is in background (driver locks screen while driving).
:::

## Test connection

After granting permissions:

1. Home screen shows the trip list
2. If you see `No trips yet` → normal (admin hasn't assigned)
3. If it reports **"Connection error"** → check:
   - WiFi/4G still on
   - Backend URL correct (open ⚙️ Connection settings to verify)
   - Contact admin to verify backend is up

## Important notes

- **Don't kill the app in background**: Settings > Apps > Battery > optimization > disable for "Road Freight Driver" so the app keeps GPS running
- **Don't clear app cache**: loses login token, must sign in again
- **The app has no ads / personal tracking**: GPS is used only for work

## Next

- [Receive a trip](/role-driver/nhan-chuyen) — When admin assigns a new trip
