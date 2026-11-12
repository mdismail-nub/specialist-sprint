import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHeader } from "@/components/cp/ui";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — CP Tracker" },
      { name: "description", content: "Roadmap for your 60-day Codeforces challenge." },
      { property: "og:title", content: "Roadmap — CP Tracker" },
      { property: "og:description", content: "Roadmap for your 60-day Codeforces challenge." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Roadmap" />
      <Empty title="Coming next">This page hasn't been built yet.</Empty>
    </div>
  );
}
