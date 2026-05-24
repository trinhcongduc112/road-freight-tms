---
title: Incident handling
sidebar_position: 2
---

# Incident handling

When a driver runs into a problem (vehicle breakdown, accident, traffic, customer absent...), they report from the **mobile app**. The Dispatcher resolves it from the web.

:::info Updating screenshot
This section needs a real incident dataset to demo — screenshots will be added after a driver tests reporting one.
:::

## Incident report flow

```
Driver hits a problem
       ↓
Open app → "Report incident" → choose type + photo + note
       ↓
Backend creates Incident record + push notification to Dispatcher
       ↓
Dispatcher resolves → closes the incident
```

## Incident types

The driver app supports 6 types:

| Type | When to use |
|---|---|
| 🚗 **Vehicle issue** | Engine failure, blown tire, out of gas |
| 🚦 **Traffic jam** | Heavy congestion impacting ETA |
| 📍 **Wrong address** | Can't find the delivery point |
| 🚫 **Customer refused** | Customer won't accept the goods |
| 👤 **Customer absent** | Arrived but nobody answered |
| ⚠️ **Other** | Other cause + description |

Each incident can include **up to 3 photos** (broken vehicle, customer signboard, scene...).

## View incidents on web

Incidents appear in **two places**:

1. **Live monitoring page** — popup alert + red marker on vehicle
2. **Sidebar > Admin > Incidents** (if module enabled) — historical list

## Resolve an incident

Click an incident → detail modal:

### Information shown

- Incident type + occurrence time
- Driver's description
- Attached photos
- GPS location when reported
- Active trip + related stop

### 4 Dispatcher actions

#### 1. Contact the driver
- Click the phone number to call
- Or send an in-app message (💬 icon)

#### 2. Reroute
For serious incidents (vehicle disabled):
- Open the **Planning page** → select the relevant date
- **Unlock** the trip (Admin permission)
- Drag remaining undelivered orders to another standby vehicle

#### 3. Mark stop as failed
For "customer absent / refused":
- Close that stop with status **FAILED**
- Note the reason for reporting

#### 4. Close incident
- After resolution, click **"Close incident"**
- Enter a **resolution note** (e.g. "Dispatched replacement vehicle at 14:30")
- Status moves: OPEN → RESOLVED

## Incident report

The **Reports > Incidents** page (optional module) shows:
- Incident count in period
- % of trips with incidents
- Most common incident type
- Driver with most incidents

Use it to improve: vehicle maintenance, driver training, customer negotiation.

## FAQ

**Q: What if the driver reports the wrong incident?**
A: Dispatcher can close it with note "false alarm". The incident remains in audit log but doesn't count in reports.

**Q: What if the Dispatcher isn't online?**
A: Notification also goes to the **IT Admin** of the org + persists in DB. Incident stays OPEN until someone resolves it.

**Q: Can the driver continue after reporting?**
A: Yes. Reporting does not lock the app — the driver continues delivering other stops if the vehicle can still drive.

## Next

- [Live monitoring](/role-dispatcher/giam-sat-hanh-trinh) — Where incidents are first detected
- [Transportation reports](/role-accountant/bao-cao) — Incident KPI rollups
