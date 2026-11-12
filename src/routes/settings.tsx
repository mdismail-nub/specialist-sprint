import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHeader } from "@/components/cp/ui";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CP Tracker" },
      { name: "description", content: "Settings for your 60-day Codeforces challenge." },
      { property: "og:title", content: "Settings — CP Tracker" },
      { property: "og:description", content: "Settings for your 60-day Codeforces challenge." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Settings" />
      <Empty title="Coming next">This page hasn't been built yet.</Empty>
    </div>
  );
}
