import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ProcureMate · 让每一笔采购都有依据",
  description:
    "预算内采购，规则外停下。活动礼品、库存补货与入职配件共用可信采购流程。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
