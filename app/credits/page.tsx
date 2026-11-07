import { CreditIntentions } from "@/components/credit-intentions";
import { CreditTabs } from "@/components/credit-tabs";
import { PageHeader } from "@/components/ui";

export default function CreditsPage() {
  return (
    <>
      <PageHeader
        title="Credits"
        description="Confirmed top-ups are your credit balance. A top-up moves USDC from your wallet to the product wallet."
        backHref="/"
      />
      <CreditTabs />
      <CreditIntentions />
    </>
  );
}
