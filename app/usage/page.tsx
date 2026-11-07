import { UsageBalance } from "@/components/credit-tabs";
import { SpendSummary } from "@/components/spend-summary";
import { PageHeader } from "@/components/ui";

export default function UsagePage() {
  return (
    <>
      <PageHeader
        title="Usage"
        description="Credits pay for buy services. The product wallet makes the call. Your wallet does not."
        backHref="/"
      />
      <UsageBalance />
      <SpendSummary />
    </>
  );
}
