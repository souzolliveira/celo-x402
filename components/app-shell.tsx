"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppNav } from "@/components/app-nav";
import { Landing } from "@/components/landing";
import { SignInScreen } from "@/components/sign-in-screen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated && pathname === "/login") router.replace("/");
  }, [ready, authenticated, pathname, router]);

  if (!ready) {
    return (
      <main id="content" className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <p className="text-muted-foreground" role="status">
          Loading sign-in…
        </p>
      </main>
    );
  }

  if (!authenticated) {
    return pathname === "/login" ? <SignInScreen /> : <Landing />;
  }

  return (
    <>
      <AppNav onSignOut={() => void logout()} />
      <div className="md:pl-60">
        <div className="mx-auto flex w-full max-w-3xl justify-end px-4 pt-4 md:hidden">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sign out
          </button>
        </div>
        <main id="content" className="mx-auto w-full max-w-3xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 md:pb-10">
          {children}
        </main>
      </div>
    </>
  );
}
