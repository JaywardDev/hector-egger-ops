import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

type OperationalListRowDensity = "dense" | "spacious";

type OperationalListRowBaseProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  titleBlockClassName?: string;
  metadataClassName?: string;
  actionsClassName?: string;
  accent?: boolean;
  density?: OperationalListRowDensity;
  className?: string;
};

type ClickableOperationalListRowProps = OperationalListRowBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
    onClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  };

type StaticOperationalListRowProps = OperationalListRowBaseProps &
  Omit<HTMLAttributes<HTMLDivElement>, "title" | "onClick"> & {
    onClick?: undefined;
  };

type OperationalListRowProps = ClickableOperationalListRowProps | StaticOperationalListRowProps;

const densityClassNames: Record<OperationalListRowDensity, string> = {
  dense: "p-3",
  spacious: "p-4 sm:p-5",
};

const baseClassName =
  "group relative grid w-full gap-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center";
const interactiveClassName =
  "hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]";

function omitOperationalListRowProps(props: OperationalListRowProps) {
  const nativeProps = { ...props } as Record<string, unknown>;

  delete nativeProps.title;
  delete nativeProps.subtitle;
  delete nativeProps.metadata;
  delete nativeProps.actions;
  delete nativeProps.titleBlockClassName;
  delete nativeProps.metadataClassName;
  delete nativeProps.actionsClassName;
  delete nativeProps.accent;
  delete nativeProps.density;
  delete nativeProps.className;

  return nativeProps;
}

function OperationalListRowContent({
  title,
  subtitle,
  metadata,
  actions,
  accent,
  titleBlockClassName,
  metadataClassName,
  actionsClassName,
}: Pick<OperationalListRowBaseProps, "title" | "subtitle" | "metadata" | "actions" | "accent" | "titleBlockClassName" | "metadataClassName" | "actionsClassName">) {
  return (
    <>
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-1 rounded-r-full bg-[var(--he-yellow)]"
        />
      ) : null}
      <div className={cn("min-w-0", titleBlockClassName)}>
        <div className="font-medium text-zinc-950">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-zinc-500">{subtitle}</div> : null}
      </div>
      {metadata ? <div className={cn("flex flex-wrap items-center gap-2 text-sm text-zinc-700 sm:justify-end", metadataClassName)}>{metadata}</div> : null}
      {actions ? <div className={cn("flex flex-wrap items-center gap-2 sm:justify-end", actionsClassName)}>{actions}</div> : null}
    </>
  );
}

export function OperationalListRow(props: OperationalListRowProps) {
  const { title, subtitle, metadata, actions, titleBlockClassName, metadataClassName, actionsClassName, accent = false, density = "spacious", className } = props;
  const rowClassName = cn(
    baseClassName,
    densityClassNames[density],
    accent ? "pl-5 sm:pl-6" : null,
    props.onClick ? interactiveClassName : null,
    className,
  );

  if (props.onClick) {
    const buttonProps = omitOperationalListRowProps(props) as ButtonHTMLAttributes<HTMLButtonElement>;
    const { onClick, type = "button", disabled } = props;

    return (
      <button className={rowClassName} disabled={disabled} onClick={onClick} type={type} {...buttonProps}>
        <OperationalListRowContent title={title} subtitle={subtitle} metadata={metadata} actions={actions} titleBlockClassName={titleBlockClassName} metadataClassName={metadataClassName} actionsClassName={actionsClassName} accent={accent} />
      </button>
    );
  }

  const divProps = omitOperationalListRowProps(props) as HTMLAttributes<HTMLDivElement>;

  return (
    <div className={rowClassName} {...divProps}>
      <OperationalListRowContent title={title} subtitle={subtitle} metadata={metadata} actions={actions} titleBlockClassName={titleBlockClassName} metadataClassName={metadataClassName} actionsClassName={actionsClassName} accent={accent} />
    </div>
  );
}
