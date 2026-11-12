import { createFileRoute } from "@tanstack/react-router";
import { Empty, PageHeader } from "@/components/cp/ui";

export const Route = createFileRoute("/problems")({
  head: () => ({
    meta: [
      { title: "Problems — CP Tracker" },
      { name: "description", content: "Problems for your 60-day Codeforces challenge." },
      { property: "og:title", content: "Problems — CP Tracker" },
      { property: "og:description", content: "Problems for your 60-day Codeforces challenge." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Problems" />
      <Empty title="Coming next">This page hasn't been built yet.</Empty>
    </div>
  );
}
