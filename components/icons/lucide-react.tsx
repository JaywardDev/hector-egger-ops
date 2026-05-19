import type { SVGProps } from "react";

export type LucideIcon = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

type IconPath = {
  d?: string;
  points?: string;
  cx?: string;
  cy?: string;
  r?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  rx?: string;
};

const iconBaseProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function createIcon(paths: { tag: "path" | "circle" | "polyline" | "rect"; attrs: IconPath }[]): LucideIcon {
  const Icon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
    <svg {...iconBaseProps} className={className} {...props}>
      {paths.map(({ tag: Tag, attrs }, index) => (
        <Tag key={index} {...attrs} />
      ))}
    </svg>
  );

  return Icon;
}

export const Clock3 = createIcon([
  { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
  { tag: "polyline", attrs: { points: "12 6 12 12 16.5 12" } },
]);

export const CircleCheck = createIcon([
  { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
  { tag: "path", attrs: { d: "m9 12 2 2 4-4" } },
]);

export const User = createIcon([
  { tag: "path", attrs: { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" } },
  { tag: "circle", attrs: { cx: "12", cy: "7", r: "4" } },
]);

export const Lock = createIcon([
  { tag: "rect", attrs: { x: "3", y: "11", width: "18", height: "11", rx: "2" } },
  { tag: "path", attrs: { d: "M7 11V7a5 5 0 0 1 10 0v4" } },
]);

export const Eye = createIcon([
  { tag: "path", attrs: { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" } },
  { tag: "circle", attrs: { cx: "12", cy: "12", r: "3" } },
]);

export const EyeOff = createIcon([
  { tag: "path", attrs: { d: "M10.7 5.1A10.9 10.9 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-3.1 4.4" } },
  { tag: "path", attrs: { d: "M6.6 6.6C3.5 8.6 2 12 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6" } },
  { tag: "path", attrs: { d: "M2 2l20 20" } },
  { tag: "path", attrs: { d: "M9.9 9.9a3 3 0 0 0 4.2 4.2" } },
]);

export const LayoutDashboard = createIcon([
  { tag: "rect", attrs: { x: "3", y: "3", width: "7", height: "9", rx: "1" } },
  { tag: "rect", attrs: { x: "14", y: "3", width: "7", height: "5", rx: "1" } },
  { tag: "rect", attrs: { x: "14", y: "12", width: "7", height: "9", rx: "1" } },
  { tag: "rect", attrs: { x: "3", y: "16", width: "7", height: "5", rx: "1" } },
]);

export const Settings = createIcon([
  { tag: "path", attrs: { d: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" } },
  { tag: "path", attrs: { d: "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.7a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.7a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9c.3.6.9 1 1.6 1h.3a2 2 0 1 1 0 4H21c-.7 0-1.3.4-1.6 1Z" } },
]);

export const ChartColumn = createIcon([
  { tag: "path", attrs: { d: "M3 3v16a2 2 0 0 0 2 2h16" } },
  { tag: "path", attrs: { d: "M18 17V9" } },
  { tag: "path", attrs: { d: "M13 17V5" } },
  { tag: "path", attrs: { d: "M8 17v-3" } },
]);

export const List = createIcon([
  { tag: "path", attrs: { d: "M8 6h13" } },
  { tag: "path", attrs: { d: "M8 12h13" } },
  { tag: "path", attrs: { d: "M8 18h13" } },
  { tag: "path", attrs: { d: "M3 6h.01" } },
  { tag: "path", attrs: { d: "M3 12h.01" } },
  { tag: "path", attrs: { d: "M3 18h.01" } },
]);

export const MapPin = createIcon([
  { tag: "path", attrs: { d: "M20 10c0 4.9-8 12-8 12S4 14.9 4 10a8 8 0 0 1 16 0Z" } },
  { tag: "circle", attrs: { cx: "12", cy: "10", r: "3" } },
]);

export const History = createIcon([
  { tag: "path", attrs: { d: "M3 12a9 9 0 1 0 3-6.7" } },
  { tag: "path", attrs: { d: "M3 3v6h6" } },
  { tag: "path", attrs: { d: "M12 7v5l3 2" } },
]);

export const Loader2 = createIcon([
  { tag: "path", attrs: { d: "M21 12a9 9 0 1 1-6.2-8.6" } },
]);

export const StickyNote = createIcon([
  { tag: "path", attrs: { d: "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" } },
  { tag: "path", attrs: { d: "M15 3v4a1 1 0 0 0 1 1h4" } },
]);
