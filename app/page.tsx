import Dashboard from "@/components/dashboard";
import bootstrap from "@/data/analytics/dashboard.json";
import type { DashboardBootstrap } from "@/lib/types";

export default function Home() {
  const internalReportsEnabled = process.env.NODE_ENV !== "production" || process.env.GOCREATE_INTERNAL_REPORTS === "enabled";
  return <Dashboard bootstrap={bootstrap as DashboardBootstrap} internalReportsEnabled={internalReportsEnabled} />;
}
