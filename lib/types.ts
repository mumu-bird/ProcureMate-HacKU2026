export type Scenario = "event" | "replenishment" | "onboarding";
export type Role = "manager" | "buyer";
export type Product = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  tags: string[];
  connector: string | null;
  sourceUrl: string;
  listingUrl: string;
  observedAt: string;
  shippingCents: number;
  shippingSource: string;
  shippingNote: string;
  stockVerified: boolean;
  compatibilityNote: string | null;
};
export type Need = {
  scenario: Scenario;
  title: string;
  brief: string;
  people: number;
  budgetCents: number;
  style: string;
  job: string;
  connectors: string[];
  address: string;
  sku?: string;
  quantity?: number;
};
export type Line = {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitCents: number;
  sourceUrl: string;
  observedAt: string;
};
export type Quote = {
  id: string;
  requestId: string;
  scenario: Scenario;
  title: string;
  optionIndex: number;
  lines: Line[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  merchant: string;
  address: string;
  currency: "HKD";
  reason: string;
  createdAt: string;
  expiresAt: string;
  revision: number;
  planner: string;
  warnings: string[];
  need: Need;
};
export type Mandate = {
  id: string;
  name: string;
  scenario: Scenario;
  requestId: string | null;
  capCents: number;
  totalCapCents: number;
  categories: string[];
  merchants: string[];
  methods: string[];
  address: string;
  allowSubstitution: boolean;
  productIds: string[];
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  version: number;
  minIntervalSeconds: number;
  rewardOwner: "company";
  actor: string;
};
export type OrderStatus =
  | "reserved"
  | "authorizing"
  | "authorized"
  | "capturing"
  | "paid"
  | "received"
  | "declined"
  | "blocked"
  | "pending"
  | "cancelled"
  | "refund_pending"
  | "refunded";
export type Order = {
  id: string;
  quoteId: string;
  quoteRevision: number;
  mandateId: string;
  quote: Quote;
  status: OrderStatus;
  paymentId: string | null;
  provider: string;
  behavior: string;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  error: string | null;
  paymentStage: "authorize" | "capture" | "refund";
  refundId?: string;
  usageReleased?: boolean;
  restocked?: boolean;
};
export type Inventory = {
  productId: string;
  name: string;
  quantity: number;
  safety: number;
  target: number;
  unit: string;
  sample: boolean;
  inTransit: number;
  suggestion: number;
};
export type Check = { code: string; pass: boolean; message: string };
export type Actor = { id: string; name: string; role: Role };
