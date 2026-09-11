import Dashboard from "@/components/dashboard";
import bootstrap from "@/data/analytics/dashboard.json";
import type { DashboardBootstrap } from "@/lib/types";

export default function Home() {
  const internalReportsFlag = process.env.GOCREATE_INTERNAL_REPORTS?.trim().toLowerCase();
  const internalReportsEnabled = process.env.NODE_ENV !== "production" || internalReportsFlag === "enabled";
  return <Dashboard bootstrap={bootstrap as DashboardBootstrap} internalReportsEnabled={internalReportsEnabled} />;
}
