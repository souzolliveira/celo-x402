"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CatalogIcon, CoinsIcon, HistoryIcon, HomeIcon, ReceiveIcon, SendIcon, UserIcon } from "@/components/icons";

const items = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/deposit", label: "Deposit", icon: ReceiveIcon },
  { href: "/credits", label: "Credits", icon: SendIcon },
  { href: "/catalog", label: "Sources", icon: CatalogIcon },
  { href: "/searches", label: "Searches", icon: HistoryIcon },
  { href: "/usage", label: "Usage", icon: CoinsIcon },
];

const accountItem = { href: "/account", label: "Account", icon: UserIcon };

export function AppNav({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <Link href="/" className="rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <span className="font-display text-2xl text-foreground">Brief</span>
          <span className="mt-1 block text-sm text-muted-foreground">Morning social listening</span>
        </Link>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} layout="side" />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink item={accountItem} pathname={pathname} layout="side" />
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-12 cursor-pointer items-center rounded-2xl px-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sign out
          </button>
        </div>
      </aside>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="flex overflow-x-auto">
          {[...items, accountItem].map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} layout="bottom" />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function NavLink({
  item,
  pathname,
  layout,
}: {
  item: (typeof items)[number] | typeof accountItem;
  pathname: string;
  layout: "side" | "bottom";
}) {
  const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const side = layout === "side";

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex cursor-pointer items-center font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        side
          ? "min-h-12 gap-3 rounded-2xl px-3"
          : "min-h-16 min-w-16 flex-1 flex-col justify-center gap-1 px-1 text-[12px] leading-none"
      } ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon />
      {item.label}
    </Link>
  );
}
