import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";

const buttonStyles = {
  primary: "bg-accent text-on-accent hover:ring-foreground focus-visible:outline-ring",
  secondary: "bg-primary text-on-primary hover:ring-foreground focus-visible:outline-ring",
  quiet: "border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-ring",
} as const;

const buttonClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-[box-shadow,background-color] duration-200 hover:ring-2 hover:ring-offset-2 hover:ring-offset-background focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  children,
  href,
  type = "button",
  variant = "primary",
  disabled = false,
  pressed,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  variant?: keyof typeof buttonStyles;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const classes = `${buttonClass} ${buttonStyles[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} className={classes} onClick={onClick} aria-pressed={pressed}>
      {children}
    </button>
  );
}

export function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeftIcon />
      Voltar
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  backHref,
}: {
  title: string;
  description?: string;
  backHref: string;
}) {
  return (
    <header className="mb-6">
      <BackLink href={backHref} />
      <h1 className="mt-4 text-4xl tracking-tight text-foreground">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-prose text-base text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  inputRef,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`mt-2 min-h-12 w-full rounded-2xl border bg-card px-4 text-base text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          error ? "border-destructive" : "border-border"
        }`}
        {...input}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  rows = 3,
  ...area
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`mt-2 w-full rounded-2xl border bg-card px-4 py-3 text-base text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          error ? "border-destructive" : "border-border"
        }`}
        {...area}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  children,
  ...select
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`mt-2 min-h-12 w-full rounded-2xl border bg-card px-4 text-base text-foreground outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          error ? "border-destructive" : "border-border"
        }`}
        {...select}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorSummary({
  title,
  errors,
  summaryRef,
}: {
  title: string;
  errors: { href: string; message: string }[];
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      className="rounded-2xl border border-destructive bg-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <h2 className="font-sans text-base font-semibold text-destructive">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {errors.map((error) => (
          <li key={error.href}>
            <a href={error.href} className="font-medium text-destructive underline">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6 ${className}`}>
      {children}
    </section>
  );
}
