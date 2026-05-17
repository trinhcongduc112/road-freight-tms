---
title: Order management
sidebar_position: 2
---

# Order management

Sales Orders are the **input** to the entire transport workflow. One order = one customer + product list + delivery date + address.

![Order list](/img/screenshots/orders-list.png)

## Two parallel lifecycles

Each order has **two statuses** in parallel:

### Approval status

```
PENDING ──(Planner/Admin approves)──> APPROVED ──(can plan)
   │
   └──(rejected)──> REJECTED
```

### Delivery status

```
OPEN ──(packed)──> PICKED_PACKED ──(vehicle delivering)──> SHIPPED
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ▼                           ▼
                                         DELIVERED                   FAILED / CANCELLED
```

:::warning Important
**Only `APPROVED` orders** can enter planning. `PENDING` orders do not appear in the "Unassigned" list on the Planning page.
:::

## Create a new order

### Method 1 — Manual (single order)

Click **"+ Create order"**:

1. **Order code** (OrderCode): auto-generated or manual
2. **Customer**: pick from Master Data
3. **Order date** + **Expected delivery date**
4. **Products**: add line items, each = `Product × Quantity`
5. **Delivery window** (optional): early/late, improves routing accuracy
6. **COD amount** (optional): if customer pays cash on delivery
7. **Notes**

After creation, order status is `PENDING` awaiting approval.

### Method 2 — Bulk Excel import

Click **"Import Excel"**:
1. Download template
2. Open Excel, one row = one order (same OrderCode = merged into one multi-line order)
3. Upload — system reports created orders & failed rows

## Approve / Reject orders

On a `PENDING` order row:
- ✅ Click **approve** → moves to `APPROVED`
- ❌ Click **reject** → modal asks for **reason**, moves to `REJECTED`

You can **bulk-select** with checkboxes and click **"Bulk approve"**.

:::tip Separation of duties
By default, Planners approve orders. For a 2-tier approval flow (Planner proposes → Admin approves), the Admin can adjust the `order.approve` permission.
:::

## Filters

The top filter bar supports multi-criteria search:

- **Customer**: search by name/code
- **Approval status**: PENDING / APPROVED / REJECTED
- **Delivery status**: OPEN / PICKED_PACKED / SHIPPED / DELIVERED / FAILED
- **Order date range** / **Delivery date range**
- **Planned yet**: yes/no

## Share tracking link with customers

Each order has a public lookup URL of the form:
```
https://<domain>/track/<OrderCode>
```

On the order row, click 🔗 → modal shows the URL → click **"Copy"** → send via Zalo/SMS/email.

The customer opens the link → sees **realtime**:
- Current order status
- Live vehicle position (if SHIPPED)
- Estimated ETA
- Driver information (name + phone)

See also: [Public order tracking](/tracking-cong-khai).

## Excel export

Click **"Export Excel"** → downloads `.xlsx` with all orders matching the current filter, including:
- Order + customer + product information
- Approval + delivery status
- Total value, COD
- Trip code (if planned)

Use it to report to customers / accounting.

## Next

- [Route planning](/role-planner/lap-ke-hoach) — Assign `APPROVED` orders to vehicles
- [Transportation reports](/role-accountant/bao-cao) — Aggregate order metrics by period
