import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
test("event purchase, receipt, refund and independently checked shipping stop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作区" }).click();
  await expect(
    page.getByRole("heading", { name: "每一笔采购，都心里有数。" }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/workspace.png", fullPage: true });
  await page.getByRole("button", { name: "生成采购方案" }).click();
  await expect(page.locator(".quote-card")).toHaveCount(3);
  await page.screenshot({ path: "artifacts/quotes.png", fullPage: true });
  await page
    .locator(".quote-card")
    .first()
    .getByRole("button", { name: "确认授权并采购" })
    .click();
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("已付款 · 待收货", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认收货入库" }).click();
  await expect(
    page.getByRole("dialog").getByText("已收货", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "申请测试退款" }).click();
  await expect(
    page.getByRole("dialog").getByText("已退款", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认整单实物退回" }).click();
  await expect(
    page.getByRole("button", { name: "确认整单实物退回" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .locator(".quote-card")
    .nth(1)
    .getByRole("button", { name: "演示运费使预算超限" })
    .click();
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("已被规则拦截", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("没有发起付款", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/blocked.png", fullPage: false });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "授权与预算", exact: true }).click();
  const count = await page.getByRole("button", { name: "撤销授权" }).count();
  expect(count).toBeGreaterThan(0);
  await page.getByRole("button", { name: "撤销授权" }).first().click();
  await expect(page.getByText("已撤销", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "执行记录", exact: true }).click();
  await expect(page.getByText("内部一致性通过", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("replenishment authorization, receipt, consumption and subsequent checks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "进入工作区" }).click();
  await page.getByRole("button", { name: /日常补货.*库存触发/ }).click();
  const generate = page.getByRole("button", { name: "生成方案", exact: true });
  await generate.first().click();
  await page
    .locator(".quote-card")
    .first()
    .getByRole("button", { name: "确认授权并采购" })
    .click();
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("已付款 · 待收货", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认收货入库" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "库存与补货", exact: true }).click();
  await expect(
    page.locator("tbody tr").first().getByText("20", { exact: true }),
  ).toBeVisible();
  await page
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: "记录领用" })
    .click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("16");
  await page.getByRole("button", { name: "确认领用并检查补货" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("tbody tr").first().getByText("4", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/inventory.png", fullPage: true });
});
test("onboarding variants, session access control, invalid payload and responsive layout", async ({
  page,
  request,
}) => {
  const anonymous = await request.get("/api/state");
  expect(anonymous.status()).toBe(401);
  await page.goto("/");
  await page.getByRole("button", { name: "采购成员", exact: false }).click();
  await page.getByRole("button", { name: "进入工作区" }).click();
  await page.getByRole("button", { name: /新员工配件.*按岗位需求/ }).click();
  await page.getByRole("button", { name: "生成采购方案" }).click();
  await expect(page.locator(".quote-card")).toHaveCount(3);
  const forbidden = await page.request.post("/api/mandates", { data: {} });
  expect(forbidden.status()).toBe(403);
  const revoke = await page.request.post("/api/revoke", {
    data: { mandateId: "not-real" },
  });
  expect(revoke.status()).toBe(403);
  const invalid = await page.request.post("/api/consume", {
    data: { productId: "coffee-black", quantity: -1, reason: "bad" },
  });
  expect(invalid.status()).toBe(400);
  const webhook = await page.request.post("/api/stripe/webhook", {
    data: { id: "unsigned" },
  });
  expect(webhook.status()).toBe(503);
  const origin = await page.request.post("/api/monitor", {
    headers: { origin: "https://evil.example" },
    data: {},
  });
  expect(origin.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
