import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

type Align = "left" | "right" | "center";

const alignClassName: Record<Align, string> = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
};

const linkBaseClassName =
  "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]";

const linkVariantClassName = {
  primary:
    "border-[var(--he-black)] bg-[var(--he-black)] text-white hover:border-[var(--he-charcoal)] hover:bg-[var(--he-charcoal)]",
  secondary: "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
} as const;

// Anchor styled to match the design-system Button (the Button component is a
// <button>, so links that act as actions use these shared classes instead).
export function ActionLink({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof linkVariantClassName;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(linkBaseClassName, linkVariantClassName[variant], className)}>
      {children}
    </Link>
  );
}

// Compact "back" affordance placed above the page header on sub-pages so users
// can step back to the parent screen without relying on the sidebar.
export function BackLink({ href, children = "Back" }: { href: string; children?: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}

// Card wrapper for a data table. On desktop the table scrolls horizontally with a
// right-edge gradient hinting at off-screen columns (matches the stock-take page).
// When `mobile` is supplied the table is hidden on small screens and the card list
// is shown instead, so the dense desktop table never forces a sideways scroll on a
// phone.
export function DataTableCard({
  title,
  description,
  actions,
  emptyMessage,
  isEmpty,
  children,
  mobile,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
  children: ReactNode;
  mobile?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <h3 className="font-medium text-zinc-900">{title}</h3>
          {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {isEmpty ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <>
          {mobile ? <div className="md:hidden">{mobile}</div> : null}
          <div className={cn("relative", mobile ? "hidden md:block" : null)}>
            <div className="-mx-3 overflow-x-auto px-3">{children}</div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-8 bg-gradient-to-l from-white to-transparent sm:block"
            />
          </div>
        </>
      )}
    </Card>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500",
        alignClassName[align],
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2 align-top text-zinc-700", alignClassName[align], className)}>
      {children}
    </td>
  );
}

export const dataTableClassName = "w-full border-collapse text-left text-sm";
export const dataTableRowClassName = "border-b border-zinc-100 transition-colors hover:bg-zinc-50";
