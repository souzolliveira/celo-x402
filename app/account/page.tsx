import { CredentialManager } from "@/components/credential-manager";
import { ProfileForm } from "@/components/profile-form";
import { PageHeader } from "@/components/ui";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  const profile = getProfile();

  return (
    <>
      <PageHeader
        title="Account"
        description={
          profile
            ? "Your details are saved. Identity verification has not run yet."
            : "Finish the account to turn on Pix."
        }
        backHref="/"
      />
      <ProfileForm initial={profile} />
      <CredentialManager />
    </>
  );
}
