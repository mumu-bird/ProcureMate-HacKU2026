# ProcureMate v0.1.1 · HacKU 2026 prototype

Local Next.js / TypeScript / SQLite procurement prototype covering event gifts, inventory replenishment and employee equipment.

This version fixes the first-purchase inventory row so new gift/accessory SKUs appear in transit before receipt. Pending refunds retain incoming quantities until resolved; already-received goods are not counted in transit again.

The three-minute captioned recording shows an actual prototype transaction, a server-side shipping-cost budget stop, replenishment and onboarding. Current demonstration uses a transparent rule planner and simulated payments. It does not represent a real HKT merchant order or verified Stripe/model network integration.

Validation: 21 core tests and 3 browser workflows passed; TypeScript and production build passed. The 7-slide PDF includes source boundaries, competitors and unverified assumptions.

The team still needs to provide model/Stripe test credentials, complete the five-participant task comparison and submit its official competition form. See `docs/award-evidence.md` and `docs/submission-checklist.md`.

Public attachments: `ProcureMate-demo.webm` (180 seconds, captions, no narration) and `ProcureMate-pitch.pdf`.
