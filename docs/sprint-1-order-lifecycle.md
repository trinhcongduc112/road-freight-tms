# Sprint 1 - Order Lifecycle MVP

Scope implemented:

- `POST /api/orders/create`
- `POST /api/orders/mobile/create`
- `POST /api/orders/change/status`
- `POST /api/orders/change/planning-status`
- `POST /api/orders/allocate`
- `GET /api/orders/:id/allocations`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders/upload` (`multipart/form-data`, field: `file`, JSON array or CSV)

## Alignment

- BA-first: keep core entities and status history explicit.
- Abivin-inspired: multiple channels for order creation, status trail, separate planning status and approval status.

## Model

`SalesOrder` (`backend/src/models/SalesOrder.js`)

- Core: `OrderCode`, `OrganizationID`, `CustomerCode`, `OrderDate`, `Items[]`
- Status set:
  - `OrderStatus`: `OPEN | PICKED_PACKED | SHIPPED | DELIVERED | CANCELLED | REJECTED`
  - `FulfillmentStatus`: `NOT_FULFILLED | FULFILLED | PARTIALLY_FULFILLED | UNFULFILLED`
  - `PlanningStatus`: `PENDING | PLANNED | LOCKED | FINALIZED`
  - `ApprovalStatus`: `PENDING | APPROVED | REJECTED`
- History: `StatusHistory[]` with `FromStatus`, `ToStatus`, `ChangedAt`, `ChangedBy`, `Note`
- Planning history: `PlanningHistory[]` with same shape

`OrderTripAllocation` (`backend/src/models/OrderTripAllocation.js`)
- `OrderID`, `OrganizationID`, `TripCode`, `RouteCode`
- `CasesAllocated`, `ItemsAllocated`
- `AllocatedBy`, `Note`

## Permission mapping

- Read/list: `order:read`
- Create (web/mobile): `order:create`
- Change status: `order:update`
- Upload: `order:import`
- Change planning status: `order:update` + route planning guard:
  - `PENDING -> PLANNED`: requires `route_plan:update`
  - `PLANNED -> LOCKED`: requires `route_plan:lock`
  - `LOCKED -> PLANNED`: requires `route_plan:unlock`
  - `LOCKED -> FINALIZED`: requires `route_plan:finalize`

## Data isolation

- Every order belongs to exactly one `OrganizationID`.
- All read/write operations enforce DAC scope via `assertOrgInScope(req.orgScope, OrganizationID)`.

## Next (Sprint 1.1)

- Approval transition rules (`ApprovalStatus`) by role.
- Endpoint batch split/consolidate helper cho dispatcher (hiện đang qua allocate + route ops).
- Import parser nâng cấp (quoted CSV, xlsx template).
- Nối allocation với entity Trip/Route chính thức khi Sprint Trip bắt đầu.
