import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const engine =
  process.env.SLIDE_ENGINE_ROOT ||
  "/Users/pomelo/.codex/skills/slide-design-skill";
const { loadSkill } = await import(
  pathToFileURL(resolve(engine, "engine/skill-loader.ts")).href
);
const { renderSlide, renderDeckShell } = await import(
  pathToFileURL(resolve(engine, "engine/renderer.ts")).href
);
const root = resolve("artifacts/deck-style");
mkdirSync(root, { recursive: true });
writeFileSync(
  resolve(root, "SKILL.md"),
  "---\nname: procuremate\nversion: 1.0.0\ndescription: Procurement prototype pitch grounded in actual software evidence.\ninspiration: ProcureMate product interface\ntypography_kit: Warm editorial sans\ncolor_kit: Sage and ink\nimage_style: Actual product screenshots\nforbidden: Invented metrics, partnerships or fabricated product UI\n---\n## Graphic system\nSolid round step markers, stamped rule receipts and budget bars connect the product story. Actual screenshots are used as evidence. State hypotheses and unverified integrations explicitly.\n",
);
writeFileSync(
  resolve(root, "tokens.json"),
  JSON.stringify(
    {
      color: {
        ground: { page: "#F7F8F2", card: "#FFFFFF", ink: "#243A2C" },
        signal: { primary: "#237553", subtle: "#DCE8D2" },
        support: { muted: "#819277", rule: "#DCE4D5" },
      },
      type: {
        header: {
          family: "Noto Sans SC, PingFang SC, sans-serif",
          weight: 600,
          scale: [86, 62, 42, 32],
        },
        body: {
          family: "Noto Sans SC, PingFang SC, sans-serif",
          weight: 400,
          scale: [30, 26, 22, 18],
        },
        data: { family: "DM Sans, sans-serif", weight: 500 },
      },
      spacing: { unit: 4, scale: [4, 8, 12, 16, 24, 32, 48, 64, 96] },
      radius: { card: 18, button: 10, input: 10 },
      elevation: { card: "none" },
      icon: { kit: "lucide" },
      page: { ratio: "16:9", width: 1920, height: 1080, safe: 96 },
    },
    null,
    2,
  ),
);
writeFileSync(
  resolve(root, "image-style.md"),
  "Prompt template: {subject}\nSearch-query template: {subject}\nDecision rules: no generated images. Only actual product screenshots.\n",
);
writeFileSync(
  resolve(root, "layout-grammar.md"),
  `| slide-type | when | required slots | optional slots | family |\n|---|---|---|---|---|\n| cover | opening | title, subtitle, note | | cover |\n| split | problem | title, body, a, b, c, source | | split-visual |\n| demo | product evidence | title, body, source | | split-visual |\n| flow | trust architecture | title, body, source | | flow-diagram |\n| comparison | competitive positioning | title, table, source | | table |\n| proof | verification | title, body, a, b, c, source | | metric-hero |\n| closing | next steps | title, body, a, b, c, source | | closing |\n`,
);
writeFileSync(
  resolve(root, "chrome.css"),
  `
.slide{font-family:'Noto Sans SC','PingFang SC',sans-serif;color:#243a2c;background:#f7f8f2;padding:82px 96px;position:relative;overflow:hidden;box-sizing:border-box;width:1920px;height:1080px}.slide h1{font-size:82px;line-height:1.25;font-weight:600;letter-spacing:-2px;margin:0}.slide h2{font-size:61px;line-height:1.35;font-weight:600;letter-spacing:-1px;margin:0}.slide p{font-size:29px;line-height:1.85;color:#637558;margin:24px 0}.deck-head{display:flex;justify-content:space-between;font-size:21px;color:#637558;margin-bottom:64px}.deck-foot{position:absolute;left:96px;right:96px;bottom:52px;display:flex;justify-content:space-between;gap:30px;font-size:18px;color:#697b5d;line-height:1.6}.kicker{font-size:22px;color:#628752;margin:0 0 30px;display:block}.big-type{font-size:108px;color:#237553;font-weight:600;letter-spacing:-4px;line-height:1.1;margin:25px 0}.cover-mark{position:absolute;right:130px;top:275px;width:405px;height:405px;background:#e1ebd4;border-radius:50%;display:grid;place-items:center}.cover-mark svg{width:240px;height:240px;stroke:#7d9c64;fill:none;stroke-width:2}.cover-stamp{position:absolute;right:108px;bottom:275px;transform:rotate(-8deg);padding:28px 35px;background:#fff;border:2px solid #b6c8a6;border-radius:15px;font-size:26px;color:#64844e}.split-stage{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;margin-top:45px}.steps{display:grid;gap:25px}.step{display:flex;gap:22px;border-bottom:1px solid #dce4d5;padding-bottom:28px;font-size:28px;line-height:1.7}.step:last-child{border:0}.step i{font-style:normal;width:52px;height:52px;border-radius:14px;background:#e6efd9;color:#52743d;display:grid;place-items:center;font-size:23px;flex-shrink:0}.step strong{display:block;font-size:29px;font-weight:500}.receipt{background:#fff;border:1px solid #dce4d5;padding:42px;border-radius:20px}.receipt span{display:block;color:#637558;font-size:23px;margin-bottom:20px}.receipt strong{display:block;font-size:45px;line-height:1.5}.receipt .seal{padding:18px 22px;background:#edf3e4;color:#52743d;margin-top:25px;font-size:26px;border-radius:8px}.demo-stage{display:grid;grid-template-columns:480px 1fr;gap:60px;margin-top:45px;align-items:center}.demo-stage p{font-size:27px}.screen{height:560px;border:1px solid #d7e2cc;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 15px 40px #5c764314}.screen img{width:100%;height:100%;object-fit:cover;object-position:center}.flow-stage{margin-top:74px}.flow-row{display:flex;gap:20px;align-items:center;margin-bottom:28px}.flow-node{border-radius:18px;border:1px solid #dce4d5;background:#fff;padding:35px 28px;flex:1;font-size:29px;text-align:center}.flow-node small{display:block;font-size:21px;color:#637558;margin-top:15px}.flow-arrow{font-size:42px;color:#567b45}.trust-band{background:#e8f0dd;border-radius:18px;padding:35px 40px;margin-top:40px;font-size:28px;color:#52743d;line-height:1.7}.comparison-stage{margin-top:50px}.dir-table{width:100%;border-collapse:collapse;font-size:26px}.dir-table th,.dir-table td{padding:26px 27px;border:1px solid #dce4d5;line-height:1.7;text-align:left}.dir-table th{background:#e7efdc;font-weight:500;color:#5d7e48}.dir-table td{background:#fff}.proof-stage{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;margin-top:80px}.proof-item{padding:32px 0;border-top:2px solid #ccdabd}.proof-item strong{font-size:105px;font-weight:500;letter-spacing:-4px;color:#237553;display:block;line-height:1.2}.proof-item span{font-size:27px;line-height:1.8;color:#637558;display:block;margin-top:24px}.source{font-size:18px;color:#697b5d}.closing-list{display:flex;gap:40px;margin-top:70px}.closing-item{flex:1;font-size:29px;line-height:1.8}.closing-item b{display:block;font-size:36px;font-weight:500;color:#64864f;margin-bottom:18px}.closing-item small{font-size:25px;color:#637558;display:block}.signature{font-size:22px;color:#637558;margin-top:60px}@media print{body{padding:0!important;background:#fff!important}.slide{margin:0!important;box-shadow:none!important;break-after:page}.slide:last-child{break-after:auto}@page{size:1920px 1080px;margin:0}}
`,
);
const head =
  '<div class="deck-head"><span>ProcureMate</span><span>HacKU 2026 · FinTech 01</span></div>';
const foot =
  '<div class="deck-foot"><span>{{source}}</span><span>{{page-no}} / {{page-total}}</span></div>';
writeFileSync(
  resolve(root, "components.html"),
  `
<template id="slide-cover"><section class="slide" data-density="editorial">${head}<span class="kicker">可信授权，完整采购</span><div class="big-type" data-visual-event="oversized-number">ProcureMate</div><h1 style="white-space:pre-line">{{title}}</h1><p style="max-width:1050px">{{subtitle}}</p><div class="cover-mark" data-visual-event="signature-mark"><svg viewBox="0 0 100 100"><path d="M25 28L50 15L75 28L50 41Z M25 42L50 55L75 42 M25 57L50 70L75 57 M50 41V70"/><path d="M66 77l7 7 14-18"/></svg></div><div class="cover-stamp" data-visual-event="visual-plate">在预算内执行<br/>越过边界，停下</div><div class="deck-foot"><span>{{note}}</span><span>{{page-no}} / {{page-total}}</span></div></section></template>
<template id="slide-split"><section class="slide">${head}<h2>{{title}}</h2><div class="split-stage"><div><p>{{body}}</p><div class="receipt" data-visual-event="visual-plate"><span>待验证的小团队采购问题</span><strong>金额变了，<br/>授权还成立吗？</strong><div class="seal">最终付款，也要符合原来的规则</div></div></div><div class="steps"><div class="step" data-visual-event="item-marker"><i>01</i><strong>{{a}}</strong></div><div class="step" data-visual-event="item-marker"><i>02</i><strong>{{b}}</strong></div><div class="step" data-visual-event="item-marker"><i>03</i><strong>{{c}}</strong></div></div></div>${foot}</section></template>
<template id="slide-demo"><section class="slide">${head}<h2>{{title}}</h2><div class="demo-stage"><div><p>{{body}}</p><div class="receipt" data-visual-event="visual-plate"><span>一笔交易 + 一次拦截</span><strong>付款没有发起</strong><div class="seal">具体规则可以在后端核对</div></div></div><div class="screen" data-visual-event="visual-plate">{{image:self-0}}</div></div>${foot}</section></template>
<template id="slide-flow"><section class="slide">${head}<h2>{{title}}</h2><p>{{body}}</p><div class="flow-stage" data-visual-event="visual-plate"><div class="flow-row"><div class="flow-node">需求与商品<small>规格、数量、价格来源</small></div><div class="flow-arrow">→</div><div class="flow-node">负责人授权<small>预算、商户、品类、期限</small></div><div class="flow-arrow">→</div><div class="flow-node">预算预留<small>数据库原子执行</small></div></div><div class="flow-row"><div class="flow-node">付款授权<small>支付渠道状态</small></div><div class="flow-arrow">→</div><div class="flow-node">再次复核<small>报价变更、到期、撤销</small></div><div class="flow-arrow">→</div><div class="flow-node">扣款与订单<small>查询结果、收货、库存</small></div></div></div><div class="trust-band" data-visual-event="visual-plate">模型负责选品，规则负责花钱。支付超时不盲目重试；退款不等于退货。</div>${foot}</section></template>
<template id="slide-comparison"><section class="slide">${head}<h2>{{title}}</h2><div class="comparison-stage">{{@table rows=rows cols=cols cells=cells}}</div><p class="source">现有产品已经具备采购控制能力。我们的轻量定位与使用价值，需要真实小公司试点验证。</p>${foot}</section></template>
<template id="slide-proof"><section class="slide">${head}<h2>{{title}}</h2><p>{{body}}</p><div class="proof-stage"><div class="proof-item" data-visual-event="oversized-number"><strong>21</strong><span>{{a}}</span></div><div class="proof-item" data-visual-event="oversized-number"><strong>3</strong><span>{{b}}</span></div><div class="proof-item" data-visual-event="oversized-number"><strong>16</strong><span>{{c}}</span></div></div><div class="trust-band">真人任务测试尚未完成；未填写企业客户、节省比例或市场规模。模型与 Stripe 网络集成尚待凭证验证。</div>${foot}</section></template>
<template id="slide-closing"><section class="slide" data-density="editorial">${head}<span class="kicker">从比赛原型，到真实采购</span><h2>{{title}}</h2><p>{{body}}</p><div class="closing-list"><div class="closing-item" data-visual-event="item-marker"><b>01 / 验证</b><small>{{a}}</small></div><div class="closing-item" data-visual-event="item-marker"><b>02 / 接入</b><small>{{b}}</small></div><div class="closing-item" data-visual-event="item-marker"><b>03 / 试点</b><small>{{c}}</small></div></div><div class="signature" data-visual-event="signature-mark">让代理能办成事，也能在该停的时候停下。</div>${foot}</section></template>
`,
);
const slides = [
  {
    type: "cover",
    slots: {
      title: "采购有条理。\n花钱有分寸。",
      subtitle:
        "活动礼品、库存补货、新员工配件。负责人一次授权，代理在边界内完成采购。",
      note: "当前原型：规则规划与模拟支付；不代表实际 HKT 商户下单。",
    },
  },
  {
    type: "split",
    slots: {
      title: "采购要完成任务，也要守住授权",
      body: "我们的假设：小团队的采购需要跨越需求、规格、完整费用与预算确认。把这些边界带到最终付款，才构成完整委托。",
      a: "活动：主题与人数决定礼品需求",
      b: "补货：库存与在途量决定采购数量",
      c: "入职：岗位与接口决定设备规格",
      source: "问题为待验证假设；目前只有学生角色任务测试条件。",
    },
  },
  {
    type: "demo",
    slots: {
      title: "先买成一笔，再证明能停下一笔",
      body: "活动方案生成三套商品组合。确认授权后执行测试付款；授权只覆盖商品金额时，含运费总额被独立规则拦截。",
      source: "实际产品截图；商品为时间戳快照，订单、库存和付款为测试。",
    },
  },
  {
    type: "flow",
    slots: {
      title: "把安全规则放在付款必经之路",
      body: "模型或规则规划器提出方案，独立规则引擎执行金融边界。每一步留下当时的金额与授权版本。",
      source:
        "实现：lib/policy.ts、lib/engine.ts、lib/payments.ts；哈希链仅检查内部一致性。",
    },
  },
  {
    type: "comparison",
    slots: {
      title: "采购控制已有成熟方案，我们选择小团队",
      rows: "Amazon Business|SAP 采购体系|ProcureMate 原型",
      cols: "已具备的能力|本项目的定位",
      cells:
        "采购政策、品类限制与审批/承认现有控制，不声称首创||业务采购流程与 AI 能力/不在比赛版复建企业系统||简单授权、三个入口、完整测试交易/轻量使用与最终付款边界；价值待验证",
      source:
        "来源：business.amazon.com/en/solutions/compliance-management/guided-buying；news.sap.com/2026/05/enabling-autonomous-spend-management-ai-connected-processes/",
    },
  },
  {
    type: "proof",
    slots: {
      title: "用可复现证据说明原型已经做到什么",
      body: "核心规则测试、浏览器任务流程与生产构建通过。只陈述已经执行的检查，不把模拟交易当成商业验证。",
      a: "核心测试：预算、撤销、并发、库存、权限与记录",
      b: "浏览器测试：活动采购、补货、配件与移动端",
      c: "真实来源商品：现金价格、独立链接、采集时间",
      source:
        "来源：tests/core.test.ts、tests/browser/workflows.spec.ts、data/catalog.json；见 artifacts 测试结果。",
    },
  },
  {
    type: "closing",
    slots: {
      title: "下一步，让真实团队与真实渠道来验证",
      body: "先证明需求，再接通正式商品、结账报价、奖励资格和支付账户。",
      a: "完成至少五名同学的人工/代理任务对照，再访谈公司行政负责人。",
      b: "配置模型与 Stripe 测试凭证；与 HKT 讨论正式商品、奖励和支付接入。",
      c: "在小公司试点，验证采购频率、授权习惯、责任边界与付费意愿。",
      source: "所有合作、企业价值与付费意愿均为后续验证方向；尚未建立合作。",
    },
  },
];
writeFileSync(
  resolve("artifacts", "pitch-content.json"),
  JSON.stringify({ slides }, null, 2),
);
const skill = await loadSkill(root);
const img =
  "data:image/png;base64," +
  readFileSync("artifacts/blocked.png").toString("base64");
const images = new Map([
  ["2-0", { url: img, source: "local", width: 1440, height: 1100 }],
]);
const htmlSlides = slides.map((node, index) =>
  renderSlide(
    node,
    { skill, resolvedImages: images },
    { index, total: slides.length },
  ),
);
const shell = renderDeckShell(skill);
const html = (shell.head + htmlSlides.join("\n") + shell.foot)
  .replace('<html lang="en">', '<html lang="zh-CN">')
  .replace(
    "<title>procuremate deck</title>",
    "<title>ProcureMate · HacKU 2026 Pitch Deck</title>",
  );
writeFileSync("artifacts/ProcureMate-pitch.html", html);
console.log("Rendered 7 slides with the slide-design-skill engine.");
