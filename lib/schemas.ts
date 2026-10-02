import { z } from "zod";
const money = z.number().int().min(1).max(10_000_000);
export const needSchema = z.object({
  scenario: z.enum(["event", "replenishment", "onboarding"]),
  title: z.string().min(1).max(120),
  brief: z.string().max(4000),
  people: z.number().int().min(1).max(100),
  budgetCents: money,
  style: z.string().max(30),
  job: z.enum(["developer", "designer", "administration"]),
  connectors: z
    .array(z.enum(["USB-A", "USB-C", "Bluetooth", "Dolce Gusto"]))
    .max(4),
  address: z.string().min(3).max(200),
  sku: z.string().max(100).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
});
export const mandateSchema = z.object({
  name: z.string().min(1).max(120),
  quoteId: z.string().optional(),
  scenario: z.enum(["event", "replenishment", "onboarding"]),
  capCents: money,
  totalCapCents: money,
  categories: z.array(z.string().min(1).max(30)).min(1).max(15),
  merchants: z.array(z.enum(["The Club · 测试商户"])).min(1),
  methods: z.array(z.enum(["card"])).min(1),
  address: z.string().min(3).max(200),
  allowSubstitution: z.boolean(),
  productIds: z.array(z.string().max(100)).min(1).max(20),
  expiresAt: z
    .string()
    .refine((v) => Number.isFinite(Date.parse(v)), "有效期格式错误"),
  minIntervalSeconds: z.number().int().min(0).max(31_536_000),
});
