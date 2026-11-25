# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Store Isolation & Identity Integrity**: Every business record (`products`, `sales`, `warranties`, `repairs`, `dailyReports`) belongs to `storeId == 'nexocell-main'` and records the authenticated, email-verified user UID (`updatedBy`, `sellerUid`, `createdBy`, `technicianUid`, `generatedByUid`).
2. **Zero Self-Promotion**: Users creating their own `/users/{userId}` profile cannot set `role: 'admin'` unless their verified token email matches the bootstrapped administrator (`jua9315@gmail.com`) or they are modified by an existing admin in `/admins/{uid}`.
3. **Immutable Audit Timestamps**: `createdAt` and `updatedAt` must equal `request.time` on creation, and `createdAt` is immutable on update while `updatedAt == request.time`.
4. **Tiered Role Updates**: Staff members can adjust inventory stock/catalog details via barcode/QR scan, create sales, register warranties, and advance active repair tickets, but cannot alter `costPrice`, `active` archival status, void sales (`status: 'Anulada'`), or modify closed daily reports (`status: 'Cerrado'`).
5. **Terminal State Locking**: Sales marked `'Anulada'`, repairs marked `'Entregado'` or `'Cancelado'`, and daily reports marked `'Cerrado'` cannot be modified by non-admin staff.
6. **PII Isolation**: User records containing emails are readable only by the profile owner or an administrator, never via blanket `isSignedIn()` list queries.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Role Self-Elevation**: Unprivileged user attempts `POST /users/{uid}` with `{ role: "admin" }`. -> **MUST DENY**.
2. **Profile Role Tampering**: Staff user attempts `PATCH /users/{uid}` changing `role` from `"staff"` to `"admin"`. -> **MUST DENY**.
3. **Shadow Ghost Field Injection**: User attempts `POST /products/{id}` with all valid fields plus `{ isAdminOverride: true }`. -> **MUST DENY** via `keys().hasOnly(...)`.
4. **Email Spoof Without Verification**: User with `email_verified: false` attempts read/write. -> **MUST DENY**.
5. **ID Poisoning Attack**: Attacker sends `POST /products/` with a 500-character document ID containing `$` or spaces. -> **MUST DENY** via `isValidId()`.
6. **Timestamp Forgery**: Client attempts `POST /sales/{id}` with backdated `createdAt` timestamp instead of `request.time`. -> **MUST DENY**.
7. **Seller UID Spoofing**: Staff A creates a sale with `sellerUid: "staff_B_uid"`. -> **MUST DENY**.
8. **Staff Cost Price Manipulation**: Non-admin staff attempts `PATCH /products/{id}` modifying `costPrice` to `0`. -> **MUST DENY**.
9. **Terminal Repair Tampering**: Non-admin staff attempts to modify a repair ticket after `status == "Entregado"`. -> **MUST DENY**.
10. **Closed Daily Report Mutation**: Non-admin staff attempts to overwrite a `dailyReports/{dateKey}` document with `status == "Cerrado"`. -> **MUST DENY**.
11. **Oversized Array Exhaustion**: Client sends `items` array with 50 items or invalid element types on `sales`. -> **MUST DENY**.
12. **Blanket User PII Scraping**: Staff user attempts `LIST /users` without restricting to own `uid`. -> **MUST DENY**.
