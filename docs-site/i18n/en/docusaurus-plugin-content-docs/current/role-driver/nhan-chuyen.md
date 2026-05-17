---
title: Receive a trip
sidebar_position: 2
---

# Receive a trip on the driver app

When the Planner finalizes a plan and assigns you to a trip, the app **automatically shows** it.

![Trip list on driver app](/img/screenshots/driver/trip-list.svg)

## Notification

When a new trip is assigned:

1. 🔔 **Push notification** appears immediately (app must be open or running in background)
2. Open the app → bell icon top corner shows **red dot + new trip count**
3. Tap the **"Trips"** tab in the bottom bar → see the new trip

If the app **doesn't receive notifications**:
- Settings > Apps > Road Freight Driver > **Notifications** → enable
- Make sure "Battery optimization" is OFF for the app
- Check WiFi/4G connectivity

## View trip detail

Tap the trip in the list → **Detail** screen with everything:

![Trip detail and stops](/img/screenshots/driver/trip-detail.svg)

### Overview
- **Trip code** + **Run date**
- **Vehicle** (code + plate + load capacity)
- **Total number of stops**
- **Planned distance** (km)
- **Departure** + **return ETA**

### Stop list

Shown in **optimized order** — follow this order to keep ETA on time and save fuel:

| Stop | Customer | Address | Goods | COD |
|---|---|---|---|---|
| 1 | KH-001 Vinamilk | 123 Đống Đa, HN | 5 boxes of milk | 0 |
| 2 | KH-002 PNJ | 456 Hai Bà Trưng | 2 boxes of watches | 1,500,000 |
| ... | ... | ... | ... | ... |

Tap a stop to see:
- **Note from Planner** (e.g. "Call 15 min before arrival")
- **Delivery window** (e.g. 8:00-11:00)
- **Customer phone** (tap to call)
- **Stop map**

## Confirm the trip

After reviewing carefully:

- If OK → tap **"Confirm trip"** at the bottom
- Trip status: `ASSIGNED` → `DRIVER_CONFIRMED`
- Dispatcher knows you're ready

If you **cannot accept** (vehicle issue, sick, other):
- Tap **"Reject trip"** → enter reason
- Notification goes to Planner/Dispatcher → they assign someone else

## Start running

When the time comes + you're at the **origin depot**:

1. Tap **"Start loading"**
2. Wait while warehouse staff loads
3. When done, tap **"Finish loading — Depart"**
4. Status: `LOADING` → `IN_PROGRESS`
5. **GPS auto-activates**, updates every 30 seconds
6. App switches to **"Delivering"** mode — shows next stop + navigation

:::tip Auto navigation
Tap 🧭 on a stop → opens Google Maps / Apple Maps with the route. Saves time vs typing the address.
:::

## While running

The app shows:
- 📍 **Next stop** (customer name, address, ETA)
- 🚚 **X/Y** — stops delivered / total
- ⏱️ **Estimated time remaining**
- 🔋 **GPS status** (green = sending)

When you arrive at a stop → tap the stop → opens **Delivery + POD** screen → see [POD guide](/role-driver/giao-hang-pod).

## FAQ

**Q: Can I run stops in reverse order?**
A: Yes, but **not recommended**. CVRP already optimized the order — reversing may pass a point twice.

**Q: Forgot a stop, can I go back?**
A: Yes. Open the stop list → choose unfinished stop → perform POD. The app does not lock the order.

**Q: Battery dies on the road?**
A: Bring a **power bank**. The app still has your last position before shutdown, and resumes when reopened.

## Next

- [Delivery & POD](/role-driver/giao-hang-pod) — Confirm successful delivery
- [Incident reporting](/role-dispatcher/xu-ly-su-co) — When something goes wrong on the road
