import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { recordPaymentEvent } from "@/lib/engine";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (
    process.env.PAYMENT_PROVIDER !== "stripe" ||
    !key?.startsWith("sk_test_") ||
    !secret
  )
    return NextResponse.json(
      { error: "测试 webhook 未配置。" },
      { status: 503 },
    );
  try {
    const stripe = new Stripe(key);
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("缺少签名。");
    const event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      secret,
    );
    if (event.livemode) throw new Error("禁止生产支付事件。");
    const value = recordPaymentEvent(
      event as unknown as Parameters<typeof recordPaymentEvent>[0],
    );
    return NextResponse.json({ received: true, ...value });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "支付事件未通过验证。" },
      { status: 400 },
    );
  }
}
