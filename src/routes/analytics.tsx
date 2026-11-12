import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHeader } from "@/components/cp/ui";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CP Tracker" },
      { name: "description", content: "Analytics for your 60-day Codeforces challenge." },
      { property: "og:title", content: "Analytics — CP Tracker" },
      { property: "og:description", content: "Analytics for your 60-day Codeforces challenge." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Analytics" />
      <Empty title="Coming next">This page hasn't been built yet.</Empty>
    </div>
  );
}
