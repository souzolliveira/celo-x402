import { getProfile, kycLabel } from "@/lib/profile";
import { ReceiveIcon, SendIcon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { WalletSummary } from "@/components/wallet-summary";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const profile = getProfile();

  return (
    <div className="grid gap-6">
      {profile ? null : (
        <Card className="border-accent">
          <h2 className="text-3xl text-foreground">Finish your account</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Without the account, Pix deposit stays off. Onchain USDC can still arrive in your wallet.
          </p>
          <Button href="/account" className="mt-4">
            Finish account
          </Button>
        </Card>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.8fr)]">
        <WalletSummary identity={profile ? kycLabel(profile.kycStatus) : null} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Button href="/deposit" className="min-h-16 w-full text-lg">
            <ReceiveIcon />
            Deposit
          </Button>
          <Button href="/credits" variant="secondary" className="min-h-16 w-full text-lg">
            <SendIcon />
            Credits
          </Button>
        </div>
      </div>
    </div>
  );
}
