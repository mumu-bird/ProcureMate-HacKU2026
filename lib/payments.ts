import Stripe from "stripe";
import { db, id, audit } from "./db";
export type PaymentState =
  | "authorized"
  | "succeeded"
  | "declined"
  | "cancelled"
  | "refunded"
  | "unknown"
  | "requires_action";
export type PaymentResult = { id: string; state: PaymentState; amount: number };
export interface Payments {
  name: string;
  authorize(
    amount: number,
    key: string,
    behavior: string,
  ): Promise<PaymentResult>;
  capture(paymentId: string, key: string): Promise<PaymentResult>;
  cancel(paymentId: string): Promise<PaymentResult>;
  query(paymentId: string): Promise<PaymentResult>;
  refund(paymentId: string, key: string): Promise<PaymentResult>;
}
function mockGet(paymentId: string): PaymentResult {
  const r = db
    .prepare("SELECT body FROM mock_payments WHERE id=?")
    .get(paymentId) as { body: string } | undefined;
  if (!r) throw new Error("Payment not found");
  return JSON.parse(r.body);
}
function mockPut(p: PaymentResult) {
  db.prepare(
    "INSERT INTO mock_payments VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
  ).run(p.id, JSON.stringify(p));
  return p;
}
export function simulatedPayments(): Payments {
  return {
    name: "simulated",
    async authorize(amount, key, behavior) {
      const paymentId = `sim_${key}`;
      const prior = db
        .prepare("SELECT body FROM mock_payments WHERE id=?")
        .get(paymentId) as { body: string } | undefined;
      if (prior) return JSON.parse(prior.body);
      audit("payment", "PAYMENT_AUTHORIZE", key, {
        provider: "simulated",
        amount,
      });
      const p = mockPut({
        id: paymentId,
        amount,
        state: behavior === "decline" ? "declined" : "authorized",
      });
      return behavior === "timeout" ? { ...p, state: "unknown" } : p;
    },
    async capture(paymentId, key) {
      const p = mockGet(paymentId);
      if (p.state === "succeeded") return p;
      if (p.state !== "authorized")
        throw new Error("Payment is not capturable");
      audit("payment", "PAYMENT_CAPTURE", key, { paymentId });
      return mockPut({ ...p, state: "succeeded" });
    },
    async cancel(paymentId) {
      const p = mockGet(paymentId);
      if (p.state === "succeeded" || p.state === "refunded") return p;
      return mockPut({ ...p, state: "cancelled" });
    },
    async query(paymentId) {
      return mockGet(paymentId);
    },
    async refund(paymentId, key) {
      const p = mockGet(paymentId);
      if (p.state === "refunded") return p;
      if (p.state !== "succeeded") throw new Error("Payment is not refundable");
      audit("payment", "PAYMENT_REFUND", key, { paymentId });
      return mockPut({ ...p, state: "refunded" });
    },
  };
}
function stripeResult(p: Stripe.PaymentIntent): PaymentResult {
  return {
    id: p.id,
    amount: p.amount,
    state:
      p.status === "succeeded"
        ? "succeeded"
        : p.status === "requires_capture"
          ? "authorized"
          : p.status === "canceled"
            ? "cancelled"
            : p.status === "requires_action"
              ? "requires_action"
              : p.status === "requires_payment_method"
                ? "declined"
                : "unknown",
  };
}
export function paymentProvider(): Payments {
  if (process.env.PAYMENT_PROVIDER !== "stripe") return simulatedPayments();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_"))
    throw new Error(
      "Stripe 模式只接受 sk_test_ 测试密钥；请配置或改用模拟模式。",
    );
  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15000 });
  return {
    name: "stripe-test",
    async authorize(amount, orderId, behavior) {
      audit("payment", "PAYMENT_AUTHORIZE", orderId, {
        provider: "stripe-test",
        amount,
      });
      // Test payment-method tokens only. No real card details or wallet tokens are accepted.
      const p = await stripe.paymentIntents.create(
        {
          amount,
          currency: "hkd",
          payment_method:
            behavior === "decline"
              ? "pm_card_chargeDeclined"
              : "pm_card_mastercard",
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          confirm: true,
          capture_method: "manual",
          metadata: { procuremate_order: orderId },
        },
        { idempotencyKey: `authorize_${orderId}` },
      );
      return stripeResult(p);
    },
    async capture(paymentId, orderId) {
      audit("payment", "PAYMENT_CAPTURE", orderId, { paymentId });
      return stripeResult(
        await stripe.paymentIntents.capture(
          paymentId,
          {},
          { idempotencyKey: `capture_${orderId}` },
        ),
      );
    },
    async cancel(paymentId) {
      return stripeResult(await stripe.paymentIntents.cancel(paymentId));
    },
    async query(paymentId) {
      return stripeResult(await stripe.paymentIntents.retrieve(paymentId));
    },
    async refund(paymentId, orderId) {
      const r = await stripe.refunds.create(
        { payment_intent: paymentId },
        { idempotencyKey: `refund_${orderId}` },
      );
      const p = await stripe.paymentIntents.retrieve(paymentId);
      return {
        id: r.id,
        amount: p.amount,
        state: r.status === "succeeded" ? "refunded" : "unknown",
      };
    },
  };
}
