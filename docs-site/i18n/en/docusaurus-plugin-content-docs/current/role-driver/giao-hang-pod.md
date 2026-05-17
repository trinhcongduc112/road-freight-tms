---
title: Delivery & POD
sidebar_position: 3
---

# Delivery and POD confirmation

**POD** = **Proof of Delivery**. By capturing a photo when delivering, the system holds **legal evidence** of receipt — critical for reconciliation + dispute prevention.

![Stop detail screen](/img/screenshots/driver/stop-detail.svg)

## Arrive at the stop

When approaching:

1. App **vibrates + notifies**: "You are near KH-002 (200m)"
2. Tap that stop in the list → opens **Delivery** screen
3. Tap **"I have arrived"** → stop status moves to `IN_PROGRESS`

## Delivery — SUCCESS case

### Step 1: Unload goods
- Customer checks goods + quantity
- Customer signs the delivery note (if printed)

### Step 2: Capture POD photo

![POD capture](/img/screenshots/driver/pod.svg)

Tap **"📷 Capture POD"** → camera opens:

- Take **1-3 photos**:
  - Photo 1: Customer + goods (face or company sign)
  - Photo 2: Signed delivery note
  - Photo 3 (optional): Measurement / tamper seal

:::warning POD photo quality
- Adequate lighting (use flash in dark warehouses)
- Clear signature + recipient name
- Don't shoot too far → text becomes unreadable
:::

### Step 3: Enter COD (if any)

If the order has **cash on delivery (COD)**:

1. Customer pays cash to you
2. Count carefully
3. App shows **"COD amount received"** field with the planned value as default
4. **Edit if different** (e.g. customer paid 1.4M instead of 1.5M)
5. Note any discrepancy

### Step 4: Mark complete

Tap **"✅ Confirm delivery success"**:

- Stop status: `IN_PROGRESS` → **`COMPLETED`**
- App uploads photos + COD to server
- Returns to stop list → this stop now has ✅

## Delivery — FAILURE case

If delivery can't happen:

1. Tap **"❌ Mark as failed"**
2. Pick a **reason** from the list:
   - Customer absent (nobody answers)
   - Customer refused
   - Wrong address
   - Damaged / wrong goods
   - Other (free text)
3. **Capture scene photo** (mandatory, for evidence):
   - Closed door + house number
   - "Moved address" sign
   - Damaged goods...
4. Tap **"Confirm"**

→ Status: `IN_PROGRESS` → **`FAILED`**
→ Notification sent to Dispatcher
→ Goods return to depot (Dispatcher decides)

:::tip Don't skip
If you can't capture evidence → **still choose "Other" + describe**. Otherwise you'll have to justify to accounting later.

## Incident reporting

For problems **not tied to a specific stop** (vehicle issue, traffic, accident):

- Main menu → **"Report incident"**
- Choose type: Vehicle / Traffic / Other
- Describe + photo + send

See also: [Incident handling](/role-dispatcher/xu-ly-su-co).

## Finishing the trip

After delivering all stops:

1. App auto-shows **"Return to depot"** screen
2. Tap **"Start return"** → status `RETURNING`
3. When at depot → tap **"Arrived at depot"**
4. **Hand over COD cash** to accountant (reconcile with the app)
5. Trip status: `RETURNING` → **`COMPLETED`**

🎉 Done! Bonus + salary are credited for this trip.

## FAQ

**Q: Forgot POD photo but already marked complete — can I edit?**
A: **Cannot edit in the app**. Contact admin to unlock the stop (with reason).

**Q: Weak signal, photo won't upload?**
A: App stores offline → auto-uploads when signal returns. No photo loss.

**Q: Customer wants a VAT invoice?**
A: App doesn't print invoices — contact company accounting to handle later.

**Q: COD short change?**
A: Note in **"Discrepancy"** field + explain. Accounting reconciles later.

## Next

- [Vehicle maintenance](/role-driver/bao-duong-xe) — When assigned a maintenance schedule
