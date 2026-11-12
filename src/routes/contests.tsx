import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHeader } from "@/components/cp/ui";

export const Route = createFileRoute("/contests")({
  head: () => ({
    meta: [
      { title: "Contests — CP Tracker" },
      { name: "description", content: "Contests for your 60-day Codeforces challenge." },
      { property: "og:title", content: "Contests — CP Tracker" },
      { property: "og:description", content: "Contests for your 60-day Codeforces challenge." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Contests" />
      <Empty title="Coming next">This page hasn't been built yet.</Empty>
    </div>
  );
}
