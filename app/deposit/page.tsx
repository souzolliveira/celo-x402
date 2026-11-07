import { DepositForm } from "@/components/deposit-form";
import { PageHeader } from "@/components/ui";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default function DepositPage() {
  return (
    <>
      <PageHeader
        title="Deposit"
        description="Receive USDC into your wallet, onchain or by the Pix stub. Buying credits is a separate step."
        backHref="/"
      />
      <DepositForm registered={getProfile() != null} />
    </>
  );
}
