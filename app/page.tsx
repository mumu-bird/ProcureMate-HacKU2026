"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Box,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  Gift,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  Actor,
  Inventory,
  Mandate,
  Need,
  Order,
  Product,
  Quote,
  Scenario,
} from "@/lib/types";

type State = {
  actor: Actor;
  products: Product[];
  quotes: Quote[];
  mandates: (Mandate & { spent: number; reserved: number })[];
  orders: Order[];
  inventory: Inventory[];
  audit: {
    seq: number;
    at: string;
    action: string;
    target: string;
    actor: string;
    detail: unknown;
    hash: string;
  }[];
  auditValid: boolean;
  paymentProvider: string;
  planner: string;
  measurements: {
    id: string;
    participant: string;
    method: string;
    seconds: number;
    steps: number;
    costCents: number;
    errors: number;
    note: string;
  }[];
};
type View = "workspace" | "mandates" | "inventory" | "orders" | "evidence";
const money = (c: number) =>
  new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 2,
  }).format(c / 100);
const date = (s: string) =>
  new Date(s).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const names: Record<Scenario, string> = {
  event: "活动与礼品",
  replenishment: "日常补货",
  onboarding: "新员工配件",
};
const statuses: Record<string, string> = {
  reserved: "预算已预留",
  authorizing: "付款授权中",
  authorized: "已授权待扣款",
  capturing: "扣款处理中",
  paid: "已付款 · 待收货",
  received: "已收货",
  declined: "支付被拒绝",
  blocked: "已被规则拦截",
  pending: "支付结果待核对",
  cancelled: "已取消",
  refund_pending: "退款待核对",
  refunded: "已退款",
};
const actionNames: Record<string, string> = {
  DEMO_INITIALIZED: "工作区初始化",
  LOGIN: "身份验证",
  PLAN_CREATED: "采购方案生成",
  MANDATE_GRANTED: "负责人确认授权",
  BUDGET_RESERVED: "通过检查并预留预算",
  PURCHASE_BLOCKED: "规则拦截采购",
  CAPTURE_ALLOWED: "扣款前复核通过",
  CAPTURE_BLOCKED: "扣款前规则拦截",
  PAYMENT_AUTHORIZE: "发起付款授权",
  PAYMENT_CAPTURE: "发起扣款",
  PAYMENT_CONFIRMED: "支付结果确认",
  MANDATE_REVOKED: "负责人撤销授权",
  GOODS_RECEIVED: "确认收货入库",
  INVENTORY_CONSUMED: "记录物品领用",
  MONITOR_RUN: "库存监控检查",
  PAYMENT_UNKNOWN: "支付结果待核对",
  REFUND_REQUESTED: "申请测试退款",
  REFUND_CONFIRMED: "确认测试退款",
  GOODS_RETURNED: "确认实物退回商户",
  MEASUREMENT_RECORDED: "录入任务测试",
};
const icons = {
  event: Gift,
  replenishment: PackagePlus,
  onboarding: BriefcaseBusiness,
};
async function api(path: string, body?: unknown) {
  const r = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "请求失败");
  return d;
}
function ProductArt({
  type = "gift",
  large = false,
}: {
  type?: string;
  large?: boolean;
}) {
  return (
    <div className={`product-art art-${type} ${large ? "large" : ""}`}>
      <div className="art-disc" />
      {type === "gift" ? (
        <>
          <div className="bottle-cap" />
          <div className="bottle-body">
            <span>thermos</span>
          </div>
          <div className="art-spark">✦</div>
        </>
      ) : type === "consumable" ? (
        <>
          <div className="coffee-pack">
            <span>NESCAFÉ</span>
            <strong>
              coffee
              <br />
              break.
            </strong>
            <i>☕</i>
          </div>
          <div className="art-spark">✦</div>
        </>
      ) : (
        <>
          <div className="keyboard-art">
            <div>
              {Array.from({ length: 30 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span>logi</span>
          </div>
          <div className="mouse-art" />
        </>
      )}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("workspace");
  const [scenario, setScenario] = useState<Scenario>("event");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loginRole, setLoginRole] = useState("manager");
  const [password, setPassword] = useState("welcome2026!");
  const [need, setNeed] = useState<Need>({
    scenario: "event",
    title: "秋日团队日 · 欢迎礼品",
    brief:
      "为 10 位年轻同事准备团队活动礼品。希望实用、简约，每人一件，可以带回家继续使用。",
    people: 10,
    budgetCents: 250000,
    style: "简约",
    job: "developer",
    connectors: ["USB-A", "USB-C", "Bluetooth"],
    address: "香港薄扶林道 · 公司办公室",
  });
  const [group, setGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [grant, setGrant] = useState<Quote | null>(null);
  const [cap, setCap] = useState(2500);
  const [totalCap, setTotalCap] = useState(2500);
  const [hours, setHours] = useState(24);
  const [substitute, setSubstitute] = useState(true);
  const [behavior, setBehavior] = useState("success");
  const [detail, setDetail] = useState<Order | null>(null);
  const [stockModal, setStockModal] = useState<Inventory | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [usageReason, setUsageReason] = useState("团队日常领用");
  const [stockSettings, setStockSettings] = useState<Inventory | null>(null);
  const [safety, setSafety] = useState(4);
  const [target, setTarget] = useState(20);
  const [measurement, setMeasurement] = useState(false);
  const [measure, setMeasure] = useState({
    participant: "P01",
    method: "manual",
    seconds: 0,
    steps: 0,
    costCents: 0,
    errors: 0,
    note: "",
  });
  const [search, setSearch] = useState("");
  async function refresh() {
    const d = await api("state");
    setState(d);
    return d as State;
  }
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  function notify(text: string, isError = false) {
    setError(isError);
    setMessage(text);
  }
  const quotes =
    state?.quotes
      .filter(
        (q) =>
          q.requestId ===
            (group ||
              state.quotes.find((q) => q.scenario === scenario)?.requestId) &&
          q.scenario === scenario,
      )
      .sort((a, b) => (a.optionIndex || 0) - (b.optionIndex || 0)) || [];
  const quote = quotes.find((q) => q.id === selected) || quotes[0];
  const activeMandates =
    state?.mandates.filter(
      (m) => !m.revokedAt && Date.parse(m.expiresAt) > Date.now(),
    ) || [];
  const matching = quote
    ? activeMandates.find(
        (m) =>
          m.scenario === quote.scenario &&
          (!m.requestId || m.requestId === quote.requestId),
      )
    : undefined;
  function switchScenario(s: Scenario) {
    setScenario(s);
    setGroup(null);
    setSelected(null);
    setNeed({
      ...need,
      scenario: s,
      title:
        s === "event"
          ? "秋日团队日 · 欢迎礼品"
          : s === "onboarding"
            ? "新同事 · 办公配件包"
            : "办公室咖啡补货",
      brief:
        s === "event"
          ? "为 10 位年轻同事准备实用、简约的团队活动礼品。"
          : s === "onboarding"
            ? "为新同事准备工作配件，根据岗位与已有设备筛选。"
            : "按库存与在途订单计算补货需求。",
      people: s === "event" ? 10 : 1,
      budgetCents: s === "event" ? 250000 : 200000,
    });
  }
  async function generate() {
    await run(async () => {
      const d = await api("plan", { ...need, scenario });
      setGroup(d.quotes[0]?.requestId);
      setSelected(d.quotes[0]?.id);
      notify("方案已生成。金额包含运费，执行前还会检查授权。");
    });
  }
  function openGrant(q: Quote, overrun = false) {
    setGrant(q);
    setCap(overrun ? q.subtotalCents / 100 : need.budgetCents / 100);
    setTotalCap(overrun ? q.subtotalCents / 100 : need.budgetCents / 100);
    setHours(24);
    setSubstitute(true);
  }
  async function execute(q: Quote, m: Mandate, b = behavior) {
    const d = await api("purchase", {
      quoteId: q.id,
      mandateId: m.id,
      behavior: b,
    });
    setDetail(d.order);
    notify(
      d.order.status === "blocked"
        ? "采购被拦截：付款没有发起。"
        : d.order.status === "paid"
          ? "测试采购完成，等待收货确认。"
          : "订单状态已记录，请查看处理结果。",
      d.order.status === "blocked",
    );
  }
  async function confirmGrant() {
    if (!grant) return;
    await run(async () => {
      const d = await api("mandates", {
        name: `${names[grant.scenario]} · ${grant.need.title}`,
        quoteId: grant.id,
        scenario: grant.scenario,
        capCents: Math.round(cap * 100),
        totalCapCents: Math.round(totalCap * 100),
        categories: [...new Set(grant.lines.map((l) => l.category))],
        merchants: ["The Club · 测试商户"],
        methods: ["card"],
        address: grant.address,
        allowSubstitution: substitute,
        productIds:
          !substitute || grant.scenario === "replenishment"
            ? grant.lines.map((l) => l.productId)
            : quotes
                .flatMap((q) => q.lines.map((l) => l.productId))
                .filter((v, i, a) => a.indexOf(v) === i),
        expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
        minIntervalSeconds: grant.scenario === "replenishment" ? 60 : 0,
      });
      const current = grant;
      setGrant(null);
      await execute(current, d.mandate);
    });
  }

  if (checking)
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" /> 正在打开采购工作区
      </div>
    );
  if (!state)
    return (
      <main className="login-page">
        <div className="login-story">
          <div className="brand">
            <span className="brand-symbol">
              <Layers3 size={23} />
            </span>
            ProcureMate<span className="beta">BETA</span>
          </div>
          <div className="login-copy">
            <span className="eyebrow">
              A LITTLE MORE TRUST. A LOT LESS BUSYWORK.
            </span>
            <h1>
              采购有条理。
              <br />
              花钱有分寸。
            </h1>
            <p>
              从团队礼品到办公室补货，
              <br />
              让代理在你确认的规则内，把事情办好。
            </p>
            <div className="login-illustration">
              <ProductArt large />
              <div className="floating-check">
                <ShieldCheck size={22} />
                <div>
                  <strong>在预算内，放心执行</strong>
                  <span>超出授权，立即停下</span>
                </div>
              </div>
            </div>
          </div>
          <small>
            HacKU 2026 · Financial Technology · Sponsored problem by HKT
          </small>
        </div>
        <div className="login-panel">
          <div className="login-box">
            <span className="pill">
              <span className="dot" /> 本地比赛原型
            </span>
            <h2>欢迎来到工作区</h2>
            <p>使用演示账户，体验完整采购流程。</p>
            <div className="role-options">
              {[
                ["manager", "负责人", "确认授权与管理预算"],
                ["buyer", "采购成员", "选品、执行与记录领用"],
              ].map(([r, n, d]) => (
                <button
                  key={r}
                  className={loginRole === r ? "chosen" : ""}
                  onClick={() => {
                    setLoginRole(r);
                    setPassword(
                      r === "manager" ? "welcome2026!" : "staff2026!",
                    );
                  }}
                >
                  <Users size={18} />
                  <strong>{n}</strong>
                  <span>{d}</span>
                  {loginRole === r && <Check size={16} />}
                </button>
              ))}
            </div>
            <label>
              演示账户密码
              <input
                aria-label="密码"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const d = await api("auth/login", {
                    username: loginRole,
                    password,
                  });
                  setState(await api("state"));
                  notify(`欢迎，${d.actor.name}`);
                })
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  进入工作区
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            {message && <div className="inline-error">{message}</div>}
            <div className="login-notice">
              <LockKeyhole size={16} />
              <span>
                模拟付款不流动真实资金。商品为来源快照，库存与公司是演示数据。
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  const paid = state.orders.filter((o) =>
    ["paid", "received"].includes(o.status),
  );
  const blocked = state.orders.filter((o) => o.status === "blocked");
  const inTransit = state.inventory.reduce((v, i) => v + i.inTransit, 0);
  const nav = [
    { id: "workspace" as View, label: "采购工作台", icon: Layers3 },
    { id: "mandates" as View, label: "授权与预算", icon: ShieldCheck },
    { id: "inventory" as View, label: "库存与补货", icon: Box },
    { id: "orders" as View, label: "采购订单", icon: FileCheck2 },
    { id: "evidence" as View, label: "执行记录", icon: Activity },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol">
            <Layers3 size={21} />
          </span>
          ProcureMate
        </div>
        <div className="workspace-switch">
          <span className="company-mark">S</span>
          <span>
            <strong>Studio North</strong>
            <small>香港 · 演示公司</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <span className="nav-caption">工作空间</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={view === n.id ? "active" : ""}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "orders" && state.orders.length > 0 && (
                <span className="nav-count">{state.orders.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-mini">
            <ShieldCheck size={22} />
            <strong>让授权成为边界</strong>
            <p>每笔付款前，独立复核规则。</p>
            <span>HKD · 单公司 · 测试环境</span>
          </div>
          <div className="profile">
            <span className="avatar">
              {state.actor.role === "manager" ? "A" : "J"}
            </span>
            <span>
              <strong>{state.actor.name.split(" · ")[0]}</strong>
              <small>
                {state.actor.role === "manager" ? "负责人" : "采购成员"}
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="退出登录"
              onClick={() =>
                run(async () => {
                  await api("auth/logout", {});
                  setState(null);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            工作空间 <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <span className="dot" />
              {state.paymentProvider === "simulated"
                ? "模拟支付"
                : "Stripe 测试"}
            </span>
            <button
              className="icon-button"
              aria-label="查看补货提醒"
              onClick={() => setView("inventory")}
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <span className="small-avatar">
              {state.actor.role === "manager" ? "A" : "J"}
            </span>
          </div>
        </header>
        <main className="main-content">
          {message && (
            <div className={`toast ${error ? "error" : ""}`} role="status">
              {error ? <ShieldX size={18} /> : <CircleCheck size={18} />}
              <span>{message}</span>
              <button aria-label="关闭提示" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR PROCUREMENT, WITHIN BOUNDS.</div>
              <h1>
                {view === "workspace"
                  ? "每一笔采购，都心里有数。"
                  : view === "mandates"
                    ? "把边界，写进每一次授权。"
                    : view === "inventory"
                      ? "让办公室，始终刚刚好。"
                      : view === "orders"
                        ? "从付款到收货，一目了然。"
                        : "每一个决定，都有据可查。"}
              </h1>
              <p>
                {view === "workspace"
                  ? "交代需求，确认规则。剩下的，让采购伙伴来完成。"
                  : view === "mandates"
                    ? "负责人确认权限，代理只能在批准范围内执行。"
                    : view === "inventory"
                      ? "收货更新库存，领用触发检查，在途订单避免重复补货。"
                      : view === "orders"
                        ? "测试订单与资金状态分别核对，收货后才增加库存。"
                        : "保存规则、报价与支付结果，解释来自当时的执行记录。"}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => window.open("/api/evidence", "_blank")}
            >
              <Download size={16} />
              导出采购记录
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span>
                已确认采购支出
                <Wallet size={17} />
              </span>
              <strong>
                {money(paid.reduce((v, o) => v + o.quote.totalCents, 0))}
              </strong>
              <small>仅统计付款成功、未退款的测试订单</small>
            </div>
            <div className="stat">
              <span>
                有效采购授权
                <ShieldCheck size={17} />
              </span>
              <strong>
                {activeMandates.length}
                <em> 份</em>
              </strong>
              <small>到期与撤销后自动停止执行</small>
            </div>
            <div className="stat">
              <span>
                在途物品
                <PackageCheck size={17} />
              </span>
              <strong>
                {inTransit}
                <em> 件</em>
              </strong>
              <small>已预留或已付款，尚未确认收货</small>
            </div>
            <div className="stat">
              <span>
                规则拦截
                <ShieldX size={17} />
              </span>
              <strong>
                {blocked.length}
                <em> 次</em>
              </strong>
              <small>可展开查看具体规则与付款记录</small>
            </div>
          </div>
          {view === "workspace" && (
            <>
              <section className="intro-banner">
                <div>
                  <span className="pill">
                    <Sparkles size={13} /> 你的采购伙伴
                  </span>
                  <h2>你定规则，我来选购。</h2>
                  <p>
                    活动礼品、日常补货、新同事配件。
                    <br />
                    不同需求，同一套可信的采购流程。
                  </p>
                  <div className="banner-points">
                    <span>
                      <CheckCheck size={15} />
                      含运费预算
                    </span>
                    <span>
                      <ShieldCheck size={15} />
                      付款前复核
                    </span>
                    <span>
                      <FileCheck2 size={15} />
                      全程有记录
                    </span>
                  </div>
                </div>
                <div className="banner-art">
                  <div className="floating-label">
                    <span className="dot" /> 授权内执行
                  </div>
                  <Gift size={72} strokeWidth={1.2} />
                  <div className="small-gift">
                    <Box size={42} strokeWidth={1.3} />
                  </div>
                  <span className="banner-star">✧</span>
                </div>
              </section>
              <div className="section-heading">
                <h2>从一项采购开始</h2>
                <span>三种需求 · 一个采购核心</span>
              </div>
              <div className="scenario-grid">
                {(["event", "replenishment", "onboarding"] as Scenario[]).map(
                  (s) => {
                    const Icon = icons[s];
                    return (
                      <button
                        key={s}
                        className={`scenario-card ${scenario === s ? "selected" : ""}`}
                        onClick={() => switchScenario(s)}
                      >
                        <span className={`scenario-icon ${s}`}>
                          <Icon size={23} />
                        </span>
                        <strong>{names[s]}</strong>
                        <p>
                          {s === "event"
                            ? "把活动方案，变成合适的礼物。"
                            : s === "replenishment"
                              ? "库存触发，补得及时也不过量。"
                              : "按岗位需求，配好第一天的工作。"}
                        </p>
                        <span className="card-arrow">
                          {scenario === s ? "正在规划" : "开始规划"}
                          <ArrowRight size={15} />
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
              <div className="workspace-columns">
                <section className="panel request-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="step-label">01 / 需求</span>
                      <h2>{names[scenario]}采购</h2>
                    </div>
                    <span className="pill subtle">
                      {state.planner === "model"
                        ? "模型配置已启用"
                        : "规则规划模式"}
                    </span>
                  </div>
                  {scenario === "replenishment" ? (
                    <>
                      <div className="callout">
                        <PackagePlus size={20} />
                        <div>
                          <strong>库存检查，自动生成采购需求</strong>
                          <p>
                            记录领用后立即检查；独立监控脚本可每分钟检查一次。
                          </p>
                        </div>
                      </div>
                      {state.inventory
                        .filter(
                          (i) =>
                            state.products.find((p) => p.id === i.productId)
                              ?.category === "consumable",
                        )
                        .map((i) => (
                          <div className="stock-compact" key={i.productId}>
                            <div>
                              <strong>
                                {i.name.replace("NESCAFÉ - ", "")}
                              </strong>
                              <span>
                                库存 {i.quantity} · 安全线 {i.safety} · 在途{" "}
                                {i.inTransit}
                              </span>
                            </div>
                            <span
                              className={`badge ${i.suggestion > 0 ? "warning" : "success"}`}
                            >
                              {i.suggestion > 0
                                ? `待补 ${i.suggestion} 盒`
                                : "库存充足"}
                            </span>
                            <button
                              className="text-button"
                              disabled={!i.suggestion || busy}
                              onClick={() =>
                                run(async () => {
                                  const n = {
                                    ...need,
                                    scenario: "replenishment",
                                    sku: i.productId,
                                    quantity: i.suggestion,
                                    people: 1,
                                    title: `办公室补货 · ${i.name}`,
                                    brief: "根据库存阈值补货",
                                  };
                                  setNeed(n as Need);
                                  const d = await api("plan", n);
                                  setGroup(d.quotes[0].requestId);
                                  setSelected(d.quotes[0].id);
                                })
                              }
                            >
                              生成方案
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        ))}
                      <button
                        className="button primary full"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const d = await api("monitor", {});
                            notify(
                              d.results.length
                                ? `检查完成：${d.results.map((r: { state: string }) => r.state).join("、")}`
                                : "库存充足或已有在途采购，无需重复下单。",
                            );
                          })
                        }
                      >
                        <Activity size={16} />
                        检查库存与自动补货
                      </button>
                      <p className="field-note">
                        自动购买需要有效补货授权。没有授权时，仅提示待补货。
                      </p>
                    </>
                  ) : (
                    <>
                      <label>
                        采购名称
                        <input
                          value={need.title}
                          onChange={(e) =>
                            setNeed({ ...need, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        说说你的采购需求
                        <textarea
                          value={need.brief}
                          rows={4}
                          onChange={(e) =>
                            setNeed({ ...need, brief: e.target.value })
                          }
                        />
                      </label>
                      <div className="form-row">
                        <label>
                          {scenario === "event" ? "参与人数" : "入职人数"}
                          <div className="input-suffix">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={need.people}
                              onChange={(e) =>
                                setNeed({
                                  ...need,
                                  people: Number(e.target.value),
                                })
                              }
                            />
                            <span>人</span>
                          </div>
                        </label>
                        <label>
                          预算上限
                          <div className="input-prefix">
                            <span>HK$</span>
                            <input
                              type="number"
                              min="1"
                              value={need.budgetCents / 100}
                              onChange={(e) =>
                                setNeed({
                                  ...need,
                                  budgetCents: Math.round(
                                    Number(e.target.value) * 100,
                                  ),
                                })
                              }
                            />
                          </div>
                        </label>
                      </div>
                      {scenario === "event" ? (
                        <label>
                          礼品风格
                          <div className="style-options">
                            {["简约", "实用", "活力", "温暖"].map((s) => (
                              <button
                                key={s}
                                className={need.style === s ? "chosen" : ""}
                                onClick={() => setNeed({ ...need, style: s })}
                              >
                                {s}
                                {need.style === s && <Check size={13} />}
                              </button>
                            ))}
                          </div>
                        </label>
                      ) : (
                        <>
                          <label>
                            员工岗位
                            <select
                              value={need.job}
                              onChange={(e) =>
                                setNeed({
                                  ...need,
                                  job: e.target.value as Need["job"],
                                })
                              }
                            >
                              <option value="developer">开发工程师</option>
                              <option value="designer">设计师</option>
                              <option value="administration">行政与运营</option>
                            </select>
                          </label>
                          <label>
                            已有设备接口
                            <div className="style-options">
                              {["USB-A", "USB-C", "Bluetooth"].map((s) => (
                                <button
                                  key={s}
                                  className={
                                    need.connectors.includes(s) ? "chosen" : ""
                                  }
                                  onClick={() =>
                                    setNeed({
                                      ...need,
                                      connectors: need.connectors.includes(s)
                                        ? need.connectors.filter((c) => c !== s)
                                        : [...need.connectors, s],
                                    })
                                  }
                                >
                                  {s}
                                  {need.connectors.includes(s) && (
                                    <Check size={13} />
                                  )}
                                </button>
                              ))}
                            </div>
                          </label>
                        </>
                      )}
                      <label>
                        统一收货地址
                        <input
                          value={need.address}
                          onChange={(e) =>
                            setNeed({ ...need, address: e.target.value })
                          }
                        />
                      </label>
                      <button
                        className="button primary full"
                        onClick={generate}
                        disabled={busy}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        生成采购方案
                        <ArrowRight size={17} />
                      </button>
                      <p className="field-note">
                        方案只使用有来源的商品；生成方案不会付款。
                      </p>
                    </>
                  )}
                </section>
                <section className="panel flow-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="step-label">02 / 执行边界</span>
                      <h2>好采购，也要有分寸</h2>
                    </div>
                    <ShieldCheck size={23} className="green" />
                  </div>
                  <div className="flow-list">
                    {[
                      {
                        icon: Search,
                        title: "先选合适的，再算完整的",
                        text: "商品、数量与运费一起比较。奖励资格不明确，便不计入节省。",
                      },
                      {
                        icon: LockKeyhole,
                        title: "你确认授权，代理才行动",
                        text: "预算、品类、商户和有效期共同约束每一次采购。",
                      },
                      {
                        icon: ShieldCheck,
                        title: "付款前，再检查一次",
                        text: "模型提出方案，独立规则决定能否花钱。越界便停下。",
                      },
                      {
                        icon: FileCheck2,
                        title: "办完有记录，异常能核对",
                        text: "保留当时的报价和规则。超时不盲目重试，收货后再入库。",
                      },
                    ].map((x, i) => (
                      <div key={x.title} className="flow-item">
                        <span>
                          <x.icon size={18} />
                        </span>
                        <div>
                          <small>0{i + 1}</small>
                          <strong>{x.title}</strong>
                          <p>{x.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="trust-footnote">
                    <span className="dot" />
                    <span>
                      测试模式 · 资金不真实流动
                      <br />
                      商品来源可查，商户订单与库存为演示数据
                    </span>
                  </div>
                </section>
              </div>
              {quotes.length > 0 && (
                <section className="quotes-section">
                  <div className="section-heading">
                    <div>
                      <span className="step-label">03 / 比较与采购</span>
                      <h2>适合这次需求的方案</h2>
                    </div>
                    <span>公司现金支出 · 含标准派送费</span>
                  </div>
                  <div className="quote-grid">
                    {quotes.map((q, i) => (
                      <article
                        key={q.id}
                        className={`quote-card ${quote?.id === q.id ? "selected" : ""}`}
                        onClick={() => setSelected(q.id)}
                      >
                        <div className="quote-top">
                          <span
                            className={`badge ${i === 0 ? "success" : "neutral"}`}
                          >
                            {q.title}
                          </span>
                          <span className="quote-choice">
                            {quote?.id === q.id && <Check size={13} />}
                          </span>
                        </div>
                        <ProductArt type={q.lines[0].category} />
                        <h3>{q.lines.map((l) => l.name).join(" + ")}</h3>
                        <p>{q.reason}</p>
                        <div className="quote-breakdown">
                          <span>
                            商品金额<strong>{money(q.subtotalCents)}</strong>
                          </span>
                          <span>
                            标准派送费<strong>{money(q.shippingCents)}</strong>
                          </span>
                          <span className="total">
                            公司现金支出<strong>{money(q.totalCents)}</strong>
                          </span>
                        </div>
                        <div className="reward-row">
                          <span>积分消耗：不使用</span>
                          <span>预计奖励：未计入</span>
                        </div>
                        <a
                          className="source-link"
                          href={q.lines[0].sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          查看商品来源
                          <ExternalLink size={12} />
                        </a>
                        <small className="source-time">
                          采集于 {date(q.lines[0].observedAt)} · 页面价格快照
                        </small>
                        <button
                          className="button primary full"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(q.id);
                            if (matching) run(() => execute(q, matching));
                            else if (state.actor.role === "manager")
                              openGrant(q);
                            else
                              notify(
                                "尚无适用授权，请负责人登录后确认。",
                                true,
                              );
                          }}
                        >
                          {matching ? "在授权内执行采购" : "确认授权并采购"}
                          <ArrowRight size={16} />
                        </button>
                        {state.actor.role === "manager" && (
                          <button
                            className="text-button demo-link"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              openGrant(q, true);
                            }}
                          >
                            演示运费使预算超限
                            <ShieldX size={13} />
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className="quote-disclosure">
                    <Clock3 size={16} />
                    <span>{quote?.warnings.join(" ")}</span>
                  </div>
                </section>
              )}
            </>
          )}
          {view === "mandates" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>已确认的采购授权</h2>
                <span className="field-note">
                  修改边界须重新授权；代理不能自行提高上限
                </span>
              </div>
              {state.mandates.length === 0 ? (
                <Empty
                  icon={ShieldCheck}
                  title="还没有采购授权"
                  text="在工作台生成方案，再由负责人确认授权。"
                />
              ) : (
                <div className="mandate-grid">
                  {state.mandates.map((m) => (
                    <article className="mandate-card" key={m.id}>
                      <div className="row-between">
                        <span className="badge neutral">
                          {names[m.scenario]}
                        </span>
                        <span
                          className={`badge ${m.revokedAt ? "danger" : Date.parse(m.expiresAt) < Date.now() ? "warning" : "success"}`}
                        >
                          {m.revokedAt
                            ? "已撤销"
                            : Date.parse(m.expiresAt) < Date.now()
                              ? "已到期"
                              : "有效授权"}
                        </span>
                      </div>
                      <h3>{m.name}</h3>
                      <div className="mandate-amount">
                        <span>单次上限</span>
                        <strong>{money(m.capCents)}</strong>
                      </div>
                      <div className="budget-meter">
                        <i
                          style={{
                            width: `${Math.min(100, ((m.spent + m.reserved) / m.totalCapCents) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="row-between field-note">
                        <span>
                          已用 {money(m.spent)} · 预留 {money(m.reserved)}
                        </span>
                        <span>总预算 {money(m.totalCapCents)}</span>
                      </div>
                      <dl>
                        <div>
                          <dt>有效期至</dt>
                          <dd>{date(m.expiresAt)}</dd>
                        </div>
                        <div>
                          <dt>批准品类</dt>
                          <dd>{m.categories.join(" / ")}</dd>
                        </div>
                        <div>
                          <dt>支付方式</dt>
                          <dd>测试卡 · 公司奖励账户</dd>
                        </div>
                        <div>
                          <dt>收货地址</dt>
                          <dd>{m.address}</dd>
                        </div>
                        <div>
                          <dt>允许替换</dt>
                          <dd>
                            {m.allowSubstitution
                              ? "授权品类内允许"
                              : "仅限指定商品"}
                          </dd>
                        </div>
                        <div>
                          <dt>授权版本</dt>
                          <dd>
                            v{m.version} · {m.id}
                          </dd>
                        </div>
                      </dl>
                      {!m.revokedAt && state.actor.role === "manager" && (
                        <button
                          className="button danger full"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api("revoke", { mandateId: m.id });
                              notify("授权已撤销。已付款订单需另外申请退款。");
                            })
                          }
                        >
                          <ShieldX size={16} />
                          撤销授权
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {view === "inventory" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>库存与自动补货</h2>
                  <p className="field-note">
                    收货入库 · 领用出库 · 扣除在途量后补至目标库存
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const d = await api("monitor", {});
                      notify(
                        `检查完成，发现 ${d.results.length} 项待补货需求。`,
                      );
                    })
                  }
                >
                  <Activity size={16} />
                  运行补货检查
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>物品</th>
                      <th>实际库存</th>
                      <th>安全库存 / 目标</th>
                      <th>在途</th>
                      <th>建议补货</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.inventory.map((i) => (
                      <tr key={i.productId}>
                        <td>
                          <div className="item-cell">
                            <span className="item-thumb">
                              <Box size={21} />
                            </span>
                            <span>
                              <strong>{i.name}</strong>
                              <small>
                                {i.sample ? "演示库存" : ""} · {i.unit}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{i.quantity}</strong>
                        </td>
                        <td>
                          {i.safety} / {i.target}
                        </td>
                        <td>{i.inTransit}</td>
                        <td>
                          <span
                            className={`badge ${i.suggestion ? "warning" : "success"}`}
                          >
                            {i.suggestion
                              ? `${i.suggestion} ${i.unit}`
                              : "无需补货"}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="button small secondary"
                              disabled={i.quantity < 1 || busy}
                              onClick={() => {
                                setStockModal(i);
                                setQuantity(1);
                              }}
                            >
                              记录领用
                            </button>
                            {state.actor.role === "manager" && (
                              <button
                                className="icon-button"
                                aria-label={`设置 ${i.name} 库存阈值`}
                                onClick={() => {
                                  setStockSettings(i);
                                  setSafety(i.safety);
                                  setTarget(i.target);
                                }}
                              >
                                <Settings2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="callout bottom-callout">
                <ShieldCheck size={20} />
                <div>
                  <strong>持续补货同样需要有效授权</strong>
                  <p>
                    在采购工作台选择“日常补货”，生成方案并确认补货授权。之后领用触发检查，满足条件才自动采购。
                  </p>
                </div>
              </div>
            </section>
          )}
          {view === "orders" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>所有采购订单</h2>
                <div className="search-field">
                  <Search size={15} />
                  <input
                    aria-label="搜索订单"
                    placeholder="搜索订单或商品"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {!state.orders.length ? (
                <Empty
                  icon={FileCheck2}
                  title="第一笔采购，等待开始"
                  text="从需求到授权，再到付款，每一步都会记录在这里。"
                />
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>采购内容</th>
                        <th>场景</th>
                        <th>金额</th>
                        <th>状态</th>
                        <th>时间</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {state.orders
                        .filter(
                          (o) =>
                            JSON.stringify(o.quote)
                              .toLowerCase()
                              .includes(search.toLowerCase()) ||
                            o.id.includes(search),
                        )
                        .map((o) => (
                          <tr key={o.id}>
                            <td>
                              <div className="item-cell">
                                <span className="item-thumb">
                                  <Gift size={20} />
                                </span>
                                <span>
                                  <strong>{o.quote.need.title}</strong>
                                  <small>
                                    {o.id} ·{" "}
                                    {o.quote.lines.reduce(
                                      (v, l) => v + l.quantity,
                                      0,
                                    )}{" "}
                                    件
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>{names[o.quote.scenario]}</td>
                            <td className="number">
                              {money(o.quote.totalCents)}
                            </td>
                            <td>
                              <Status status={o.status} />
                            </td>
                            <td className="field-note">{date(o.createdAt)}</td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() => setDetail(o)}
                              >
                                详情
                                <ArrowUpRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {view === "evidence" && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>可核对的执行记录</h2>
                    <p className="field-note">
                      哈希链检查记录内部一致性，不代表运营者无法重写整条记录。
                    </p>
                  </div>
                  <span
                    className={`badge ${state.auditValid ? "success" : "danger"}`}
                  >
                    <ShieldCheck size={13} />
                    {state.auditValid ? "内部一致性通过" : "记录校验失败"}
                  </span>
                </div>
                <div className="audit-list">
                  {state.audit.map((a) => (
                    <details key={a.seq} className="audit-item">
                      <summary>
                        <span
                          className={`audit-icon ${a.action.includes("BLOCKED") ? "blocked" : ""}`}
                        >
                          {a.action.includes("BLOCKED") ? (
                            <ShieldX size={17} />
                          ) : (
                            <FileCheck2 size={17} />
                          )}
                        </span>
                        <span>
                          <strong>{actionNames[a.action] || a.action}</strong>
                          <small>
                            {a.actor} · {a.target}
                          </small>
                        </span>
                        <time>{date(a.at)}</time>
                        <ChevronDown size={15} />
                      </summary>
                      <pre>{JSON.stringify(a.detail, null, 2)}</pre>
                      <small className="hash">SHA-256 {a.hash}</small>
                    </details>
                  ))}
                </div>
              </section>
              <section className="panel measurement-panel">
                <div className="panel-heading">
                  <div>
                    <h2>人工与代理任务对照</h2>
                    <p className="field-note">
                      仅录入实际测试；学生角色测试不能证明企业需求或商业价值。
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setMeasurement(true)}
                  >
                    <Plus size={16} />
                    记录测试
                  </button>
                </div>
                {!state.measurements.length ? (
                  <Empty
                    icon={Users}
                    title="尚未录入用户测试结果"
                    text="请让同学分别完成同一任务，记录时间、步骤、费用和错误。"
                  />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>参与者</th>
                          <th>方法</th>
                          <th>耗时</th>
                          <th>步骤</th>
                          <th>费用</th>
                          <th>错误</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.measurements.map((m) => (
                          <tr key={m.id}>
                            <td>{m.participant}</td>
                            <td>{m.method === "manual" ? "人工" : "代理"}</td>
                            <td>{m.seconds} 秒</td>
                            <td>{m.steps}</td>
                            <td>{money(m.costCents)}</td>
                            <td>{m.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={14} />
              ProcureMate · 每一笔采购都有依据
            </span>
            <span>HacKU 2026 / FinTech 01 · 测试原型</span>
          </footer>
        </main>
      </div>
      {grant && (
        <Modal title="确认采购授权" onClose={() => setGrant(null)}>
          <div className="callout">
            <ShieldCheck size={20} />
            <div>
              <strong>确认后，代理可在规则内自动采购</strong>
              <p>
                授权人：{state.actor.name} · 用途：{names[grant.scenario]}
              </p>
            </div>
          </div>
          <div className="grant-summary">
            <span>当前方案 · 含运费</span>
            <strong>{money(grant.totalCents)}</strong>
          </div>
          <div className="form-row">
            <label>
              单次金额上限（HK$）
              <input
                type="number"
                min="1"
                value={cap}
                onChange={(e) => {
                  setCap(Number(e.target.value));
                  if (grant.scenario !== "replenishment")
                    setTotalCap(Number(e.target.value));
                }}
              />
            </label>
            <label>
              累计预算（HK$）
              <input
                type="number"
                min="1"
                value={totalCap}
                onChange={(e) => setTotalCap(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              有效时长（小时）
              <input
                type="number"
                min="1"
                max="720"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </label>
            <label>
              测试付款结果
              <select
                value={behavior}
                onChange={(e) => setBehavior(e.target.value)}
              >
                <option value="success">正常成功</option>
                <option value="decline">支付拒绝</option>
                <option value="timeout">授权超时（模拟）</option>
              </select>
            </label>
          </div>
          <dl className="grant-rules">
            <div>
              <dt>批准商户</dt>
              <dd>The Club · 测试商户</dd>
            </div>
            <div>
              <dt>批准品类</dt>
              <dd>
                {[...new Set(grant.lines.map((l) => l.category))].join(" / ")}
              </dd>
            </div>
            <div>
              <dt>收货地址</dt>
              <dd>{grant.address}</dd>
            </div>
            <div>
              <dt>奖励归属</dt>
              <dd>公司；未确认的积分与奖励不计入节省</dd>
            </div>
          </dl>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={substitute}
              onChange={(e) => setSubstitute(e.target.checked)}
            />
            允许授权品类内替换商品，仍须满足预算与规格
          </label>
          {cap * 100 < grant.totalCents && (
            <div className="inline-error">
              当前授权上限低于含运费总额。执行将被拦截，付款不会发起。
            </div>
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setGrant(null)}>
              返回修改
            </button>
            <button
              className="button primary"
              disabled={busy || !cap || !totalCap || hours <= 0 || hours > 720}
              onClick={confirmGrant}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              确认授权并执行
            </button>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title="采购执行详情" onClose={() => setDetail(null)}>
          <div className="row-between">
            <Status status={detail.status} />
            <span className="field-note">
              {detail.provider === "simulated" ? "模拟付款" : "Stripe 测试付款"}
            </span>
          </div>
          <h3 className="order-title">{detail.quote.need.title}</h3>
          <div className="order-lines">
            {detail.quote.lines.map((l) => (
              <div key={l.productId}>
                <span>
                  {l.name}
                  <small>
                    数量 {l.quantity} · 单价 {money(l.unitCents)}
                  </small>
                </span>
                <strong>{money(l.quantity * l.unitCents)}</strong>
              </div>
            ))}
          </div>
          <div className="grant-summary">
            <span>含运费总金额</span>
            <strong>{money(detail.quote.totalCents)}</strong>
          </div>
          {detail.error && <div className="inline-error">{detail.error}</div>}
          <dl>
            <div>
              <dt>订单编号</dt>
              <dd>{detail.id}</dd>
            </div>
            <div>
              <dt>付款编号</dt>
              <dd>
                {detail.paymentId ||
                  (detail.status === "blocked"
                    ? "没有发起付款"
                    : "支付编号尚未返回；请核对")}
              </dd>
            </div>
            <div>
              <dt>授权编号</dt>
              <dd>{detail.mandateId}</dd>
            </div>
            <div>
              <dt>报价版本</dt>
              <dd>v{detail.quoteRevision}</dd>
            </div>
          </dl>
          <div className="modal-actions wrap">
            {detail.status === "paid" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const d = await api("receive", { orderId: detail.id });
                    setDetail(d.order);
                    notify("已确认收货，库存已更新。");
                  })
                }
              >
                <PackageCheck size={16} />
                确认收货入库
              </button>
            )}
            {["pending", "authorized", "refund_pending"].includes(
              detail.status,
            ) && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const d = await api("reconcile", { orderId: detail.id });
                    setDetail(d.order);
                    notify("已查询支付结果。");
                  })
                }
              >
                <Activity size={16} />
                核对支付结果
              </button>
            )}
            {["paid", "received"].includes(detail.status) &&
              state.actor.role === "manager" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const d = await api("refund", { orderId: detail.id });
                      setDetail(d.order);
                      notify("测试退款已处理；库存不会自动减少。");
                    })
                  }
                >
                  <ArrowDownLeft size={16} />
                  申请测试退款
                </button>
              )}
            {detail.status === "refunded" &&
              detail.receivedAt &&
              !detail.restocked && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const d = await api("return-goods", {
                        orderId: detail.id,
                      });
                      setDetail(d.order);
                      notify(
                        "已确认整单实物退回，库存已扣减。退款与退货分别记录。",
                      );
                    })
                  }
                >
                  <ArrowDownLeft size={16} />
                  确认整单实物退回
                </button>
              )}
            {detail.status === "blocked" && (
              <button
                className="button primary"
                onClick={() => {
                  setScenario(detail.quote.scenario);
                  setNeed(detail.quote.need);
                  setGroup(detail.quote.requestId);
                  setSelected(null);
                  setDetail(null);
                  setView("workspace");
                  notify(
                    "请比较含运费总额，选择更低费用方案或调整需求；扩大预算须由负责人重新授权。现有授权保持不变。",
                  );
                  setTimeout(
                    () =>
                      document
                        .querySelector(".quotes-section")
                        ?.scrollIntoView({ behavior: "smooth" }),
                    100,
                  );
                }}
              >
                返回方案重新选择
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => {
                setDetail(null);
                setView("evidence");
              }}
            >
              查看执行记录
            </button>
          </div>
        </Modal>
      )}
      {stockModal && (
        <Modal title="记录物品领用" onClose={() => setStockModal(null)}>
          <p className="field-note">
            {stockModal.name} · 当前库存 {stockModal.quantity} {stockModal.unit}
          </p>
          <label>
            领用数量
            <input
              type="number"
              min="1"
              max={stockModal.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label>
            领用用途
            <input
              value={usageReason}
              onChange={(e) => setUsageReason(e.target.value)}
            />
          </label>
          <button
            className="button primary full"
            disabled={busy || quantity < 1 || quantity > stockModal.quantity}
            onClick={() =>
              run(async () => {
                await api("consume", {
                  productId: stockModal.productId,
                  quantity,
                  reason: usageReason,
                });
                setStockModal(null);
                notify("领用已记录，补货条件已自动检查。");
              })
            }
          >
            确认领用并检查补货
          </button>
        </Modal>
      )}
      {stockSettings && (
        <Modal title="设置库存规则" onClose={() => setStockSettings(null)}>
          <p>{stockSettings.name}</p>
          <div className="form-row">
            <label>
              安全库存
              <input
                type="number"
                min="0"
                value={safety}
                onChange={(e) => setSafety(Number(e.target.value))}
              />
            </label>
            <label>
              补货目标
              <input
                type="number"
                min="1"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="field-note">
            库存不高于安全线时，扣除在途量后补至目标；仍须通过采购授权。
          </p>
          <button
            className="button primary full"
            disabled={busy || target <= safety}
            onClick={() =>
              run(async () => {
                await api("inventory/settings", {
                  productId: stockSettings.productId,
                  safety,
                  target,
                });
                setStockSettings(null);
                notify("库存规则已更新。");
              })
            }
          >
            保存规则
          </button>
        </Modal>
      )}
      {measurement && (
        <Modal title="记录实际任务测试" onClose={() => setMeasurement(false)}>
          <p className="field-note">
            两种方法使用相同采购需求，并交换测试顺序；不填入预计结果。
          </p>
          <div className="form-row">
            <label>
              匿名参与者
              <input
                value={measure.participant}
                onChange={(e) =>
                  setMeasure({ ...measure, participant: e.target.value })
                }
              />
            </label>
            <label>
              测试方法
              <select
                value={measure.method}
                onChange={(e) =>
                  setMeasure({ ...measure, method: e.target.value })
                }
              >
                <option value="manual">人工采购</option>
                <option value="agent">代理采购</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              耗时（秒）
              <input
                type="number"
                min="0"
                value={measure.seconds}
                onChange={(e) =>
                  setMeasure({ ...measure, seconds: Number(e.target.value) })
                }
              />
            </label>
            <label>
              操作步骤
              <input
                type="number"
                min="0"
                value={measure.steps}
                onChange={(e) =>
                  setMeasure({ ...measure, steps: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              最终费用（HK$）
              <input
                type="number"
                min="0"
                value={measure.costCents / 100}
                onChange={(e) =>
                  setMeasure({
                    ...measure,
                    costCents: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
            <label>
              错误次数
              <input
                type="number"
                min="0"
                value={measure.errors}
                onChange={(e) =>
                  setMeasure({ ...measure, errors: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label>
            条件与备注
            <textarea
              rows={3}
              value={measure.note}
              onChange={(e) => setMeasure({ ...measure, note: e.target.value })}
            />
          </label>
          <button
            className="button primary full"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("measurements", measure);
                setMeasurement(false);
                notify("测试结果已记录。");
              })
            }
          >
            保存真实测试结果
          </button>
        </Modal>
      )}
    </div>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span
      className={`badge ${["paid", "received", "refunded"].includes(status) ? "success" : ["blocked", "declined"].includes(status) ? "danger" : ["pending", "refund_pending"].includes(status) ? "warning" : "neutral"}`}
    >
      {statuses[status] || status}
    </span>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Gift;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={30} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
