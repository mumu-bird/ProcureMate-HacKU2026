import { atomic, audit, db, get, id, inventory, list, now, put } from "./db";
import { checks } from "./policy";
import { paymentProvider, type Payments, type PaymentResult } from "./payments";
import { plan } from "./planner";
import type { Actor, Mandate, Order, Quote } from "./types";

const system: Actor = { id: "monitor", name: "库存监控", role: "buyer" };
function saveOrder(o: Order) {
  o.updatedAt = now();
  put("order", o);
  return o;
}
function release(o: Order) {
  db.prepare("UPDATE usage SET state='released' WHERE order_id=?").run(o.id);
}
function finish(o: Order, result: PaymentResult) {
  return atomic(() => {
    const current = get<Order>("order", o.id)!;
    if (current.status === "received" || current.status === "refunded")
      return current;
    current.status =
      result.state === "succeeded"
        ? "paid"
        : result.state === "refunded"
          ? "refunded"
          : "pending";
    if (result.state === "succeeded")
      db.prepare("UPDATE usage SET state='spent' WHERE order_id=?").run(o.id);
    if (result.state === "refunded") release(current);
    current.error =
      result.state === "unknown" ? "支付结果尚未确认，请核对。" : null;
    audit(
      "payment",
      result.state === "succeeded" ? "PAYMENT_CONFIRMED" : "PAYMENT_UPDATED",
      o.id,
      { state: result.state, paymentId: o.paymentId },
    );
    return saveOrder(current);
  });
}
async function capture(o: Order, provider: Payments): Promise<Order> {
  const ready = atomic(() => {
    const current = get<Order>("order", o.id)!;
    const q = current.quote;
    const m = get<Mandate>("mandate", current.mandateId)!;
    const result = checks(q, m, current.id);
    if (result.some((c) => !c.pass)) {
      current.status = "blocked";
      current.error = result
        .filter((c) => !c.pass)
        .map((c) => c.message)
        .join("；");
      audit("policy", "CAPTURE_BLOCKED", current.id, {
        checks: result,
        paymentCaptured: false,
      });
      saveOrder(current);
      return false;
    }
    current.status = "capturing";
    current.paymentStage = "capture";
    saveOrder(current);
    audit("policy", "CAPTURE_ALLOWED", current.id, {
      checks: result,
      mandateVersion: m.version,
    });
    return true;
  });
  if (!ready) {
    try {
      const p = await provider.cancel(o.paymentId!);
      if (p.state === "cancelled") atomic(() => release(o));
      else if (p.state === "succeeded") return finish(o, p);
    } catch {
      const current = get<Order>("order", o.id)!;
      current.status = "pending";
      current.error = "拦截成功，付款授权取消结果待核对；预算继续预留。";
      saveOrder(current);
    }
    return get<Order>("order", o.id)!;
  }
  try {
    return finish(o, await provider.capture(o.paymentId!, o.id));
  } catch {
    const current = get<Order>("order", o.id)!;
    current.status = "pending";
    current.error = "扣款结果未确认；不自动重试，请查询支付结果。";
    saveOrder(current);
    audit("payment", "PAYMENT_UNKNOWN", o.id, { stage: "capture" });
    return current;
  }
}
export async function purchase(
  actor: Actor,
  quoteId: string,
  mandateId: string,
  behavior = "success",
  injected?: Payments,
): Promise<Order> {
  const provider = injected || paymentProvider();
  let created = false;
  const order = atomic(() => {
    const prior = list<Order>("order").find(
      (o) => o.quoteId === quoteId && o.mandateId === mandateId,
    );
    if (prior) return prior;
    const q = get<Quote>("quote", quoteId);
    const m = get<Mandate>("mandate", mandateId);
    if (!q || !m) throw new Error("采购方案或授权不存在。");
    const result = checks(q, m);
    if (q.scenario === "replenishment") {
      const inv = inventory().find(
        (v) => v.productId === q.lines[0]?.productId,
      );
      result.push({
        code: "REPLENISHMENT",
        pass: !!inv && inv.suggestion >= q.lines[0].quantity,
        message: "补货数量不得超过当前需求；在途订单已计入。",
      });
    }
    const blocked = result.some((c) => !c.pass);
    const o: Order = {
      id: id("order"),
      quoteId: q.id,
      quoteRevision: q.revision,
      mandateId: m.id,
      quote: q,
      status: blocked ? "blocked" : "reserved",
      paymentId: null,
      provider: provider.name,
      behavior,
      createdAt: now(),
      updatedAt: now(),
      receivedAt: null,
      error: blocked
        ? result
            .filter((c) => !c.pass)
            .map((c) => c.message)
            .join("；")
        : null,
      paymentStage: "authorize",
    };
    put("order", o);
    audit(actor.id, blocked ? "PURCHASE_BLOCKED" : "BUDGET_RESERVED", o.id, {
      checks: result,
      totalCents: q.totalCents,
      quoteRevision: q.revision,
      mandateVersion: m.version,
      paymentCalled: false,
    });
    if (!blocked) {
      db.prepare("INSERT INTO usage VALUES(?,?,?,?)").run(
        o.id,
        m.id,
        q.totalCents,
        "reserved",
      );
      created = true;
    }
    return o;
  });
  if (!created) return order;
  order.status = "authorizing";
  saveOrder(order);
  let result: PaymentResult;
  try {
    result = await provider.authorize(
      order.quote.totalCents,
      order.id,
      behavior,
    );
  } catch (e) {
    const error = e as { code?: string; payment_intent?: { id: string } };
    if (error.code === "card_declined") {
      order.status = "declined";
      order.paymentId = error.payment_intent?.id || null;
      order.error = "测试支付被拒绝，预算已释放。";
      atomic(() => {
        release(order);
        saveOrder(order);
        audit("payment", "PAYMENT_DECLINED", order.id, {
          budgetReleased: true,
        });
      });
    } else {
      order.status = "pending";
      order.error = "支付授权结果未知；预算保持预留，不能重复下单。";
      saveOrder(order);
      audit("payment", "PAYMENT_UNKNOWN", order.id, { stage: "authorize" });
    }
    return order;
  }
  order.paymentId = result.id;
  if (result.state === "declined" || result.state === "cancelled") {
    order.status = result.state === "declined" ? "declined" : "cancelled";
    order.error = "付款未完成，预算已释放。";
    atomic(() => {
      release(order);
      saveOrder(order);
      audit("payment", "PAYMENT_DECLINED", order.id, { state: result.state });
    });
    return order;
  }
  if (result.state === "unknown" || result.state === "requires_action") {
    order.status = "pending";
    order.error =
      result.state === "requires_action"
        ? "支付渠道要求额外认证，请人工处理；不会绕过认证。"
        : "已发送付款授权，结果待核对；不会重复扣款。";
    saveOrder(order);
    audit("payment", "PAYMENT_UNKNOWN", order.id, {
      stage: "authorize",
      paymentId: result.id,
    });
    return order;
  }
  if (result.state === "succeeded") return finish(order, result);
  order.status = "authorized";
  saveOrder(order);
  return capture(order, provider);
}
export async function reconcile(
  orderId: string,
  provider = paymentProvider(),
): Promise<Order> {
  const o = get<Order>("order", orderId);
  if (!o) throw new Error("订单不存在。");
  if (!["pending", "authorized", "refund_pending"].includes(o.status)) return o;
  if (!o.paymentId)
    throw new Error("缺少支付编号，请先在支付渠道核对；系统不会重新发起付款。");
  if (o.status === "refund_pending") {
    // Refund retries are safe only under the same provider idempotency key.
    const r = await provider.refund(o.paymentId, o.id);
    return applyRefund(o, r);
  }
  const p = await provider.query(o.paymentId);
  if (p.state === "succeeded") return finish(o, p);
  if (p.state === "authorized") {
    o.status = "authorized";
    saveOrder(o);
    return capture(o, provider);
  }
  if (p.state === "cancelled" || p.state === "declined") {
    o.status = p.state === "declined" ? "declined" : "cancelled";
    atomic(() => {
      release(o);
      saveOrder(o);
      audit("payment", "PAYMENT_RECONCILED", o.id, { state: p.state });
    });
  }
  return get<Order>("order", o.id)!;
}
export async function revoke(
  actor: Actor,
  mandateId: string,
  provider = paymentProvider(),
) {
  if (actor.role !== "manager") throw new Error("只有负责人可以撤销授权。");
  atomic(() => {
    const m = get<Mandate>("mandate", mandateId);
    if (!m) throw new Error("授权不存在。");
    m.revokedAt = now();
    m.version++;
    put("mandate", m);
    audit(actor.id, "MANDATE_REVOKED", m.id, {
      version: m.version,
      notice: "扣款已发出的订单需核对结果，已付款订单需退款。",
    });
  });
  for (const o of list<Order>("order").filter(
    (v) =>
      v.mandateId === mandateId &&
      v.paymentId &&
      ["authorized", "pending"].includes(v.status),
  )) {
    try {
      const p = await provider.query(o.paymentId!);
      if (p.state === "authorized") {
        const cancelled = await provider.cancel(o.paymentId!);
        if (cancelled.state === "cancelled") {
          o.status = "cancelled";
          atomic(() => {
            release(o);
            saveOrder(o);
          });
        }
      } else if (p.state === "succeeded") finish(o, p);
    } catch {
      audit("payment", "REVOCATION_RECONCILIATION_REQUIRED", o.id, {
        budgetReserved: true,
      });
    }
  }
  return get<Mandate>("mandate", mandateId)!;
}
export function receive(actor: Actor, orderId: string) {
  return atomic(() => {
    const o = get<Order>("order", orderId);
    if (!o) throw new Error("订单不存在。");
    if (o.receivedAt) return o;
    if (o.status !== "paid") throw new Error("只有已确认付款的订单可以收货。");
    for (const l of o.quote.lines) {
      db.prepare("INSERT OR IGNORE INTO inventory VALUES(?,?,?,?,?,?)").run(
        l.productId,
        0,
        0,
        l.quantity,
        "件",
        1,
      );
      db.prepare(
        "UPDATE inventory SET quantity=quantity+? WHERE product_id=?",
      ).run(l.quantity, l.productId);
      db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?)").run(
        `receive_${o.id}_${l.productId}`,
        l.productId,
        l.quantity,
        "收货入库",
        actor.id,
        now(),
      );
    }
    o.status = "received";
    o.receivedAt = now();
    saveOrder(o);
    audit(actor.id, "GOODS_RECEIVED", o.id, { lines: o.quote.lines });
    return o;
  });
}
export function consume(
  actor: Actor,
  productId: string,
  quantity: number,
  reason: string,
) {
  atomic(() => {
    const r = db
      .prepare("SELECT quantity FROM inventory WHERE product_id=?")
      .get(productId) as { quantity: number } | undefined;
    if (!r || quantity > r.quantity) throw new Error("领用数量超过实际库存。");
    db.prepare(
      "UPDATE inventory SET quantity=quantity-? WHERE product_id=?",
    ).run(quantity, productId);
    db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?)").run(
      id("movement"),
      productId,
      -quantity,
      reason,
      actor.id,
      now(),
    );
    audit(actor.id, "INVENTORY_CONSUMED", productId, { quantity, reason });
  });
}
function applyRefund(o: Order, result: PaymentResult) {
  return atomic(() => {
    const current = get<Order>("order", o.id)!;
    if (current.status === "refunded") return current;
    if (result.state !== "refunded") {
      current.status = "refund_pending";
      current.error = "退款结果待核对，预算未释放。";
      return saveOrder(current);
    }
    current.status = "refunded";
    current.refundId = result.id;
    current.error = null;
    release(current);
    saveOrder(current);
    audit("payment", "REFUND_CONFIRMED", o.id, {
      refundId: result.id,
      inventoryUnchanged: true,
      notice: "资金退款不等于商品退库，退货另行记录。",
    });
    return current;
  });
}
export async function refund(
  actor: Actor,
  orderId: string,
  provider = paymentProvider(),
) {
  if (actor.role !== "manager") throw new Error("只有负责人可以申请测试退款。");
  const o = atomic(() => {
    const v = get<Order>("order", orderId);
    if (!v) throw new Error("订单不存在。");
    if (v.status === "refunded" || v.status === "refund_pending") return v;
    if (!["paid", "received"].includes(v.status) || !v.paymentId)
      throw new Error("此订单不能退款。");
    v.status = "refund_pending";
    v.paymentStage = "refund";
    saveOrder(v);
    audit(actor.id, "REFUND_REQUESTED", v.id, {});
    return v;
  });
  if (o.status === "refunded") return o;
  try {
    return applyRefund(o, await provider.refund(o.paymentId!, o.id));
  } catch {
    o.error = "退款结果待核对；资金与库存尚未更改。";
    saveOrder(o);
    return o;
  }
}
export async function monitor() {
  const results: { sku: string; state: string; orderId?: string }[] = [];
  for (const stock of inventory().filter((v) => v.suggestion > 0)) {
    const active = list<Mandate>("mandate").filter(
      (m) =>
        m.scenario === "replenishment" &&
        !m.revokedAt &&
        Date.parse(m.expiresAt) > Date.now() &&
        m.productIds.includes(stock.productId),
    );
    const mandate = active[0];
    if (!mandate) {
      results.push({ sku: stock.productId, state: "需要补货授权" });
      continue;
    }
    const [quote] = await plan(
      {
        scenario: "replenishment",
        title: `补货 · ${stock.name}`,
        brief: "由库存阈值触发",
        people: 1,
        budgetCents: mandate.capCents,
        style: "实用",
        job: "administration",
        connectors: [],
        address: mandate.address,
        sku: stock.productId,
        quantity: stock.suggestion,
      },
      system.id,
    );
    const order = await purchase(system, quote.id, mandate.id);
    results.push({
      sku: stock.productId,
      state: order.status,
      orderId: order.id,
    });
  }
  audit(system.id, "MONITOR_RUN", "inventory", { results });
  return results;
}

export function returnGoods(actor: Actor, orderId: string) {
  return atomic(() => {
    const o = get<Order>("order", orderId);
    if (!o) throw new Error("订单不存在。");
    if (o.restocked) return o;
    if (o.status !== "refunded" || !o.receivedAt)
      throw new Error("只有已退款且已收货的订单可以记录退货。");
    for (const l of o.quote.lines) {
      const row = db
        .prepare("SELECT quantity FROM inventory WHERE product_id=?")
        .get(l.productId) as { quantity: number } | undefined;
      if (!row || row.quantity < l.quantity)
        throw new Error("库存不足以退回整笔订单；已有领用需另行核对。");
    }
    for (const l of o.quote.lines) {
      db.prepare(
        "UPDATE inventory SET quantity=quantity-? WHERE product_id=?",
      ).run(l.quantity, l.productId);
      db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?)").run(
        `return_${o.id}_${l.productId}`,
        l.productId,
        -l.quantity,
        "已退款商品退回商户",
        actor.id,
        now(),
      );
    }
    o.restocked = true;
    saveOrder(o);
    audit(actor.id, "GOODS_RETURNED", o.id, { lines: o.quote.lines });
    return o;
  });
}

export function recordPaymentEvent(event: {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      amount?: number;
      currency?: string;
      status?: string;
      payment_intent?: string | null;
    };
  };
}) {
  return atomic(() => {
    if (db.prepare("SELECT id FROM payment_events WHERE id=?").get(event.id))
      return { duplicate: true };
    const object = event.data.object;
    const o = list<Order>("order").find(
      (v) =>
        v.provider === "stripe-test" &&
        (v.paymentId === object.id ||
          v.paymentId === object.payment_intent ||
          (!v.paymentId &&
            v.id === object.metadata?.procuremate_order &&
            event.type.startsWith("payment_intent."))),
    );
    if (o) {
      if (
        event.type.startsWith("payment_intent.") &&
        (object.amount !== o.quote.totalCents || object.currency !== "hkd")
      )
        throw new Error("支付事件金额或币种不匹配。");
      if (!o.paymentId && event.type.startsWith("payment_intent."))
        o.paymentId = object.id;
      if (
        event.type === "payment_intent.succeeded" &&
        !["received", "refunded", "refund_pending"].includes(o.status)
      ) {
        o.status = "paid";
        o.error = null;
        db.prepare("UPDATE usage SET state='spent' WHERE order_id=?").run(o.id);
        saveOrder(o);
      }
      if (
        event.type === "payment_intent.canceled" &&
        !["paid", "received", "refunded", "refund_pending"].includes(o.status)
      ) {
        o.status = "cancelled";
        release(o);
        saveOrder(o);
      }
      if (
        event.type === "payment_intent.payment_failed" &&
        !["paid", "received", "refunded", "refund_pending"].includes(o.status)
      ) {
        o.status = "declined";
        release(o);
        saveOrder(o);
      }
      if (
        ["refund.updated", "refund.created"].includes(event.type) &&
        object.status === "succeeded" &&
        o.status === "refund_pending"
      ) {
        if (object.amount !== o.quote.totalCents || object.currency !== "hkd")
          throw new Error("只接受本订单全额 HKD 测试退款事件。");
        o.status = "refunded";
        o.refundId = object.id;
        o.error = null;
        release(o);
        saveOrder(o);
      }
      audit("stripe", "STRIPE_EVENT_APPLIED", o.id, {
        eventId: event.id,
        type: event.type,
      });
    }
    db.prepare("INSERT INTO payment_events VALUES(?,?)").run(
      event.id,
      JSON.stringify({ type: event.type, matched: !!o, at: now() }),
    );
    return { duplicate: false, matched: !!o };
  });
}
