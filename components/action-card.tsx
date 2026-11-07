import Link from "next/link";

export function ActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-24 cursor-pointer items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
        {icon}
      </span>
      <span>
        <span className="block text-lg font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
