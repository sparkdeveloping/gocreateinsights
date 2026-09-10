import Dashboard from "@/components/dashboard";
import bootstrap from "@/data/analytics/dashboard.json";
import type { DashboardBootstrap } from "@/lib/types";

export default function Home() {
  return <Dashboard bootstrap={bootstrap as DashboardBootstrap} />;
}
