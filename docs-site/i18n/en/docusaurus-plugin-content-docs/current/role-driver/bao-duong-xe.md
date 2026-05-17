---
title: Receive and complete maintenance
sidebar_position: 4
---

# Receive and complete vehicle maintenance

In addition to deliveries, drivers also receive **vehicle maintenance jobs** — oil change, tires, routine inspection. The workflow is similar to receiving a trip but simpler.

![Maintenance on driver app](/img/screenshots/driver/maintenance.svg)

## Workflow

```
Master Data > Maintenance > Schedule
       ↓
Planner/Admin assigns driver to perform
       ↓
🔔 Driver receives notification
       ↓
"Accept job" → ACKNOWLEDGED status
       ↓
On-site → IN_PROGRESS
       ↓
Done → photo evidence → AWAITING_REVIEW
       ↓
Admin/accountant approves → COMPLETED ✅
```

## 1. Receive notification

When the admin assigns maintenance:

- 🔔 Push notification: "You've been assigned maintenance for vehicle 29B-12345"
- Bell icon in the app shows a red dot
- Open **Notifications** → tap the maintenance row

## 2. View details

The detail screen shows:

- **Vehicle** under maintenance (code + license plate)
- **Maintenance type**:
  - 🛢️ Engine oil change
  - 🛞 Tire replacement
  - 🔧 Brake inspection
  - 🔋 Battery check
  - ⚙️ General maintenance
  - 🔩 Repair
  - ... (8 types)
- **Planned date**
- **Deadline**
- **Notes from admin** (e.g. "Bring vehicle to Toyota Cau Giay garage")
- **Current status**

## 3. Accept the job

Tap **"Accept job"**:

- Status: `SCHEDULED` → **`ACKNOWLEDGED`**
- Admin knows you're ready + will perform

If busy → tap **"Decline"** + state a reason (off, sick, conflicting trip...).

## 4. Start work

When arriving at the garage / shop / maintenance facility:

- Tap **"Start work"**
- Status: `ACKNOWLEDGED` → **`IN_PROGRESS`**

The app lets you **run a delivery trip and a maintenance job the same day** — but only one item can be `IN_PROGRESS` at a time.

## 5. Complete

When maintenance is done:

### Step 1: Photo evidence

Tap **"📷 Capture completion photo"** → camera opens. Take **1-5 photos**:

- Shop / garage invoice
- The repaired part (e.g. new tire)
- Odometer reading
- Tamper-evident seal (if any)

:::warning Photos are proof
Photos help admin/accountant **verify** the work before approving. No photos = no approval = no maintenance bonus.
:::

### Step 2: Add a note (optional)

The **"Completion note"** field: write what you actually did. E.g.:
> "Replaced engine oil Motul 5W30, oil filter, air filter. Total 850k. Invoice attached."

### Step 3: Submit for review

Tap **"Submit for review"**:

- Status: `IN_PROGRESS` → **`AWAITING_REVIEW`**
- Notification sent to admin/accountant

## 6. Wait for approval

`AWAITING_REVIEW` may last **1-3 days**:

- Admin views photos + notes
- Compares with planned cost
- If OK → click "Approve" → status `COMPLETED` ✅
- If not → returned with note "Need photo X" → back to `IN_PROGRESS`

## View history

Open the **"Maintenance"** tab in the app → 2 sub-tabs:

- **Upcoming**: jobs not yet done
- **Completed**: maintenance history (view past photos)

## FAQ

**Q: I'm not the regular driver of this vehicle, why am I assigned?**
A: Admin may assign **any** driver. Reasons: the regular driver is on a trip / on leave. You step in → still earn the work credit.

**Q: Does maintenance count toward salary?**
A: Configurable per organization. By default **not included** in [payroll](/role-accountant/bang-luong) — but admin can add a separate bonus.

**Q: Quick fix on the road (temporary patch) — log as maintenance?**
A: **No**. That's an [incident](/role-dispatcher/xu-ly-su-co). Maintenance = planned work with date + type.

**Q: Forgot to add photo, already submitted?**
A: Contact admin → they return status to `IN_PROGRESS` → you supplement photos.

## Next

- [Delivery & POD](/role-driver/giao-hang-pod) — Main workflow
- [Install the app](/role-driver/cai-dat-app) — Grant camera permission for photos
