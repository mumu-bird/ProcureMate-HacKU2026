# ProcureMate

面向小团队的受授权约束采购助手。活动礼品、库存补货、新员工配件共用规则检查、预算预留、测试支付与执行记录。

**比赛版已经可以本地运行。当前默认使用透明规则规划器和模拟支付，未接入真实商户下单。** 商品价格是带采集时间的 The Club 页面快照；公司、库存、订单与用户角色为演示数据。没有编造用户验证结果、企业客户或节省比例。

[三分钟演示视频](https://github.com/mumu-bird/ProcureMate-HacKU2026/releases/download/v0.1.1/ProcureMate-demo.webm) · [七页路演 PDF](https://github.com/mumu-bird/ProcureMate-HacKU2026/releases/download/v0.1.1/ProcureMate-pitch.pdf) · [按评分准备的证据](docs/award-evidence.md)

## 运行

需要 Node.js 24 或更新版本，使用其内置 `node:sqlite`。

```bash
npm ci
npm run dev
```

打开 <http://127.0.0.1:3000>。账户已经在登录界面预填：

| 身份     | 用户名  | 本地演示密码 | 权限                              |
| -------- | ------- | ------------ | --------------------------------- |
| 负责人   | manager | welcome2026! | 授予/撤销授权、库存规则、测试退款 |
| 采购成员 | buyer   | staff2026!   | 规划、执行已有授权、领用、收货    |

会话由服务端生成，使用 HttpOnly、SameSite=Strict cookie；客户端的角色值不能改变权限。默认服务只监听本机。非本地使用前必须设置自定义账户密码，并完成部署与安全配置。

SQLite 数据保存在 `data/procuremate.sqlite`，刷新或重启不会丢失。该文件不进入仓库。可用 `PROCUREMATE_DB` 指定其他路径。

生产运行：

```bash
npm run build
npm start
```

独立库存检查：

```bash
npm run monitor
```

每 60 秒运行一次；记录领用也会立即触发检查。没有有效授权时只预警。库存不高于安全线时，补货数量等于目标库存减去实际库存与在途数量；预算预留和再次检查避免并发重复下单。

## 演示

1. 以负责人登录，保持默认团队活动需求，生成三套礼品方案。
2. 选择推荐方案，检查授权卡并执行。交易成功后确认收货。
3. 另一方案点击“演示运费使预算超限”。授权只覆盖商品金额，含标准运费的总额被服务端拦截；订单没有付款编号。
4. 日常补货生成咖啡补货方案并授予持续授权。确认收货，再记录领用，查看检查与预算记录。
5. 切换新员工配件，根据岗位和设备接口生成方案。清空设备接口时系统要求补充信息。
6. 执行记录导出 JSON。记录哈希链只能检查内部一致性，不能证明运营者无法重写整个数据库。

演示视频与七页路演稿放在 `artifacts/`。完整演示使用隔离数据库，不会替你的工作区添加示范订单。

路演 PDF 与 HTML 可直接使用。重建 HTML 需要本地 `slide-design-skill` 排版引擎，设置 `SLIDE_ENGINE_ROOT` 后执行 `npx tsx scripts/build-deck.ts`；然后 `node scripts/render-deck.mjs` 输出 PDF 与逐页截图。浏览器脚本使用已安装的 Playwright Chromium，也可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。

`scripts/record-demo.mjs` 用于在端口 3200 的全新演示数据库录制操作。原始录像包含页面加载等待，重新录制后须剪辑并核对最终时长；本次提交的视频已核对为 180 秒，使用字幕，没有语音。不要用已有采购记录的数据库覆盖工作区。

## 模型与支付配置

复制 `.env.example` 为 `.env.local`，配置你的测试凭证。不得把密钥提交到仓库。

### 模型

设置 `MODEL_API_KEY`、`MODEL_BASE_URL` 和 `MODEL_NAME`。接口采用兼容的 `/chat/completions` JSON 调用。模型只在经过规格筛选的候选商品中排序；数量、价格、商户和授权不由模型决定。输出必须匹配目录 ID。12 秒超时或结构错误时回退规则规划器，界面与日志披露回退。

未提供密钥时，页面明确显示“规则规划模式”，不能宣称实际模型推理已经验证。

### Stripe 测试

设置 `PAYMENT_PROVIDER=stripe` 与 `STRIPE_SECRET_KEY=sk_test_...`。生产密钥会被拒绝。当前测试接口使用 Stripe 官方测试付款方式 token，先授权再扣款；不接受真实卡信息，不代表已连接公司钱包或 HKT 商户接口。

设置 `STRIPE_WEBHOOK_SECRET` 后，测试回调地址是 `/api/stripe/webhook`。接收器检查签名、测试模式、付款编号、金额与币种；事件去重，乱序成功事件不会重复入库。

支付结果未知时继续预留预算，明确进入待核对状态，不重新扣款。没有付款编号时须先通过支付渠道与签名回调核对，不假装交易失败。退款仅支持全额测试退款；已收货的实物不会随退款自动减少，商品实际退回后另记退货。

官方参考：[测试支付](https://docs.stripe.com/testing)、[授权与扣款](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)、[回调验证](https://docs.stripe.com/webhooks)。没有配置凭证的情况下，真实 Stripe 与模型网络集成尚未经过测试。

## 来源与金额口径

`data/catalog.json` 保存 16 个商品的独立商品链接、列表链接、现金价格和观察时间。`scripts/collect_catalog.py` 可重新采集；需要 Python 与 lxml。采集失败会停止，不会自动补造商品。

- 运费引用 [The Club 派送规则](https://shop.theclub.com.hk/shipping-policy?___store=en_US) 的标准 HK$80 办公/住宅派送价。测试商户按此规则计价；真实商品可能存在其他派送条件、免运费或库存限制，未验证。
- 商品金额与派送金额分别展示，不承诺实时可售或实际交期。
- [购物条款](https://shop.theclub.com.hk/terms-and-conditions?___store=en_US) 与 [积分说明](https://shop.theclub.com.hk/reward-points) 存在不同兑换表述，未验证账户资格，所以不自动使用积分或估算奖励。
- 公司现金支出、积分消耗和预计奖励分列。个人积分不能算公司的节省。
- 所有金额以整数港币分存储、计算。最终执行金额来自服务端保存的报价，浏览器不能传一个更低价格绕过规则。

## 核心架构

```text
活动需求 / 领用库存 / 员工岗位
                ↓
          共用采购规划器
                ↓
        有来源的商品与报价
                ↓
  负责人授权 → 服务端规则 → 原子预算预留
                ↓
   付款授权 → 再次复核 → 扣款 → 结果核对
                ↓
      订单 → 收货 → 库存流水
          全过程写入执行记录
```

- `lib/policy.ts`：场景、需求、品类、商户、支付方式、地址、替换权限、单次/累计预算、频率、授权有效期、报价与奖励归属。
- `lib/engine.ts`：在跨网络请求前提交预算预留；网络期间不持有数据库事务。扣款发出前再次检查撤销与报价版本。扣款已发出后撤销不能保证阻止资金流动，必须查询结果或退款。
- `lib/payments.ts`：模拟与 Stripe 测试适配器，共用授权、扣款、取消、查询、退款能力。
- `lib/db.ts`：SQLite 持久化、预算预留、库存流水与记录链。

接口统一在 `app/api/[...path]/route.ts`，所有业务接口检查服务端会话。授权、撤销、退款与库存规则更新需要负责人权限。支付工具与模型密钥只在服务端。

## 验证与提交

```bash
npm test
npm run typecheck
npm run test:browser
npm run build
```

浏览器测试使用独立临时数据库。首次使用需 `npx playwright install chromium`；在当前工作环境会优先使用已安装的 Chromium。测试报告、截图、演示录像与路演稿在 `artifacts/`，测试说明在 `docs/validation.md`。

真实用户测试仍需团队完成：至少五名同学分别走人工与代理路线，交换任务顺序，记录时间、步骤、费用、错误。原型提供录入表；目前没有录入虚构结果。企业需求与付费意愿仍待验证。

比赛交付检查见 `docs/submission-checklist.md`；路演讲稿见 `docs/pitch-notes.md`。本项目对应 HacKU 2026 FinTech 题目一“Give a Machine a Wallet – Agentic Commerce”，申报 HKT 专项奖。

## 开源依赖与原创范围

应用代码在本次赛事期间从零编写，使用 Next.js、React、TypeScript、Lucide、Stripe SDK、Zod、tsx 与 Playwright。SQLite 由 Node.js 提供。上述库保留其各自许可证；没有复制既有应用模板。视觉由本项目 CSS 与图标组合绘制。路演稿使用本地 slide-design-skill 的排版引擎，内容与产品截图来自本项目。

没有集成 Raccoon Work，因此不宣称符合商汤专项奖资格。
