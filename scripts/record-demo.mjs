import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
mkdirSync("artifacts/video-raw", { recursive: true });
const cachedBrowser =
  "/Users/pomelo/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync(cachedBrowser) ? cachedBrowser : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:3200",
  viewport: { width: 1440, height: 1080 },
  recordVideo: {
    dir: "artifacts/video-raw",
    size: { width: 1440, height: 1080 },
  },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:3200");
const started = performance.now();
async function waitUntil(seconds) {
  const remaining = seconds * 1000 - (performance.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
}
async function caption(title, text) {
  await page.evaluate(
    ({ title, text }) => {
      let el = document.getElementById("demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-caption";
        el.style.cssText =
          "position:fixed;bottom:22px;left:246px;right:28px;z-index:9999;background:rgba(28,57,40,.96);color:#fff;border-radius:12px;padding:19px 25px;box-shadow:0 8px 25px #18392233;pointer-events:none;font-family:system-ui;font-size:17px";
        document.body.appendChild(el);
      }
      el.replaceChildren();
      const h = document.createElement("strong");
      h.textContent = title;
      h.style.cssText =
        "display:block;font-size:20px;margin-bottom:6px;color:#dcebcf";
      const p = document.createElement("span");
      p.textContent = text;
      el.append(h, p);
    },
    { title, text },
  );
}
try {
  await caption(
    "ProcureMate · HacKU 2026",
    "本视频为真实原型操作。模拟支付不流动资金；公司、库存和商户订单为演示数据。",
  );
  await waitUntil(7);
  await page.getByRole("button", { name: "进入工作区" }).click();
  await caption(
    "一次授权，三种采购需求",
    "活动礼品、日常补货、新员工配件，共用同一套预算、权限与支付规则。",
  );
  await waitUntil(15);
  await page.locator(".request-panel").scrollIntoViewIfNeeded();
  await caption(
    "01 · 从活动需求开始",
    "10 位年轻同事，实用简约礼品，预算 HK$2,500，统一办公室收货。需求文本不会增加采购权限。",
  );
  await waitUntil(26);
  await page.getByRole("button", { name: "生成采购方案" }).click();
  await page.locator(".quotes-section").scrollIntoViewIfNeeded();
  await caption(
    "02 · 比较完整支出",
    "商品来自有时间戳的真实页面。金额包含标准运费；积分价值不确定、账户资格未确认，便不计入节省。",
  );
  await waitUntil(42);
  await page
    .locator(".quote-card")
    .first()
    .getByRole("button", { name: "确认授权并采购" })
    .click();
  await caption(
    "03 · 负责人确认边界",
    "确认金额、品类、商户、有效期和替换权限。代理无法自行提高预算或延长授权。",
  );
  await waitUntil(56);
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("已付款 · 待收货", { exact: true })
    .waitFor();
  await caption(
    "04 · 测试交易完成",
    "服务端先检查并预留预算，付款授权后再复核，最后确认扣款。记录保留报价与授权版本。",
  );
  await waitUntil(72);
  await page.getByRole("button", { name: "确认收货入库" }).click();
  await caption(
    "收货与资金分别记账",
    "付款成功建立在途订单；收货确认才增加库存。重复确认不会重复入库。",
  );
  await waitUntil(84);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .locator(".quote-card")
    .nth(1)
    .getByRole("button", { name: "演示运费使预算超限" })
    .click();
  await caption(
    "05 · 演示授权只覆盖商品金额",
    "这次测试故意把上限设为商品金额。已观察到的标准 HK$80 运费仍需计入最终支出。",
  );
  await waitUntil(96);
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("已被规则拦截", { exact: true })
    .waitFor();
  await caption(
    "规则确实拦停了代理",
    "订单显示“没有发起付款”。可核对后端规则记录，而不是仅在前端显示一条警告。",
  );
  await waitUntil(110);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: /日常补货.*库存触发/ }).click();
  await page.locator(".request-panel").scrollIntoViewIfNeeded();
  await caption(
    "06 · 库存驱动日常补货",
    "领用减少库存；达到安全线后，扣除在途量补至目标。缺少有效授权时只预警，不擅自购买。",
  );
  await page
    .getByRole("button", { name: "生成方案", exact: true })
    .first()
    .click();
  await page.locator(".quotes-section").scrollIntoViewIfNeeded();
  await page
    .locator(".quote-card")
    .first()
    .getByRole("button", { name: "确认授权并采购" })
    .click();
  await page
    .getByRole("button", { name: "确认授权并执行", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("已付款 · 待收货", { exact: true })
    .waitFor();
  await waitUntil(126);
  await page.getByRole("button", { name: "确认收货入库" }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "库存与补货", exact: true }).click();
  await caption(
    "在途、实物与预算保持一致",
    "收货更新实际库存。重复补货检查不会为同一缺口创建第二笔付款。",
  );
  await waitUntil(138);
  await page.getByRole("button", { name: "采购工作台", exact: true }).click();
  await page.getByRole("button", { name: /新员工配件.*按岗位需求/ }).click();
  await page.getByRole("button", { name: "生成采购方案" }).click();
  await page.locator(".quotes-section").scrollIntoViewIfNeeded();
  await caption(
    "07 · 按岗位配置新员工配件",
    "开发、设计、行政使用不同模板。缺少设备接口时要求补充，不猜测兼容性。",
  );
  await waitUntil(153);
  await page.getByRole("button", { name: "执行记录", exact: true }).click();
  const block = page
    .locator(".audit-item")
    .filter({ hasText: "规则拦截采购" })
    .first();
  await block.scrollIntoViewIfNeeded();
  await block.locator("summary").click();
  await caption(
    "每一个决定，都有依据",
    "记录包含触发规则、金额、报价和授权版本。哈希链检查内部一致性，不声称运营者无法重写。",
  );
  const evidence = await page.request.get("/api/evidence");
  writeFileSync(
    "artifacts/demo-evidence.json",
    JSON.stringify(await evidence.json(), null, 2),
  );
  await waitUntil(169);
  await page.getByRole("button", { name: "采购工作台", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await caption(
    "ProcureMate · 采购有条理，花钱有分寸",
    "16 个商品来源快照 · 已验证规则与交易流程 · 模型、Stripe 测试接口已预留，当前演示使用规则规划与模拟支付。",
  );
  await waitUntil(180);
  const video = page.video();
  await context.close();
  const path = await video.path();
  renameSync(path, "artifacts/ProcureMate-demo.webm");
  console.log(
    "Saved artifacts/ProcureMate-demo.webm; recording target 180 seconds.",
  );
} finally {
  await browser.close();
}
