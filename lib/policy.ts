import { get, list, usage } from "./db";
import type { Check, Mandate, Order, Product, Quote } from "./types";
export function checks(
  quote: Quote,
  mandate: Mandate,
  ownOrderId?: string,
): Check[] {
  const used = usage(mandate.id);
  const own = ownOrderId ? get<Order>("order", ownOrderId) : undefined;
  const ownAmount =
    own &&
    ["reserved", "authorizing", "authorized", "capturing", "pending"].includes(
      own.status,
    )
      ? own.quote.totalCents
      : 0;
  const mostRecent = list<Order>("order").find(
    (o) =>
      o.mandateId === mandate.id &&
      o.id !== ownOrderId &&
      !["blocked", "declined", "cancelled", "refunded"].includes(o.status),
  );
  const current = get<Quote>("quote", quote.id);
  const pricing =
    quote.lines.every((l) => {
      const p = get<Product>("product", l.productId);
      return (
        p &&
        p.priceCents === l.unitCents &&
        p.category === l.category &&
        Number.isSafeInteger(l.quantity) &&
        l.quantity > 0
      );
    }) &&
    quote.subtotalCents ===
      quote.lines.reduce((v, l) => v + l.unitCents * l.quantity, 0) &&
    quote.totalCents === quote.subtotalCents + quote.shippingCents;
  return [
    {
      code: "ACTIVE",
      pass: !mandate.revokedAt,
      message: mandate.revokedAt ? "授权已撤销" : "授权仍然有效",
    },
    {
      code: "EXPIRY",
      pass: Date.parse(mandate.expiresAt) > Date.now(),
      message: "授权必须在有效期内",
    },
    {
      code: "SCENARIO",
      pass: mandate.scenario === quote.scenario,
      message: "用途必须符合授权场景",
    },
    {
      code: "REQUEST",
      pass: !mandate.requestId || mandate.requestId === quote.requestId,
      message: "一次性授权只能用于指定采购需求",
    },
    {
      code: "CATEGORY",
      pass: quote.lines.every((l) => mandate.categories.includes(l.category)),
      message: "所有商品品类必须在授权内",
    },
    {
      code: "MERCHANT",
      pass: mandate.merchants.includes(quote.merchant),
      message: "商户必须在批准名单内",
    },
    {
      code: "METHOD",
      pass: mandate.methods.includes("card"),
      message: "测试卡付款必须获准",
    },
    {
      code: "ADDRESS",
      pass: quote.address === mandate.address,
      message: "收货地址必须与授权一致",
    },
    {
      code: "SUBSTITUTION",
      pass:
        mandate.allowSubstitution ||
        quote.lines.every((l) => mandate.productIds.includes(l.productId)),
      message: "商品替换必须得到授权",
    },
    {
      code: "CAP",
      pass: quote.totalCents <= mandate.capCents,
      message: `含运费总额必须不超过 HK$${(mandate.capCents / 100).toFixed(2)}`,
    },
    {
      code: "TOTAL_CAP",
      pass:
        used.spent + used.reserved - ownAmount + quote.totalCents <=
        mandate.totalCapCents,
      message: "已花费、预留与本次采购之和必须在累计预算内",
    },
    {
      code: "FREQUENCY",
      pass:
        !mostRecent ||
        Date.now() - Date.parse(mostRecent.createdAt) >=
          mandate.minIntervalSeconds * 1000,
      message: "采购频率必须符合授权",
    },
    {
      code: "QUOTE",
      pass:
        !!current &&
        current.revision === quote.revision &&
        Date.parse(quote.expiresAt) > Date.now() &&
        pricing,
      message: "报价版本、有效期与商品金额必须可核对",
    },
    {
      code: "REWARD_OWNER",
      pass: mandate.rewardOwner === "company",
      message: "个人奖励不能计入公司节省",
    },
  ];
}
