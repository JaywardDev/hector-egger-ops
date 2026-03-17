export type AppNavItem = {
  label: string;
  href: string;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Inventory", href: "/inventory" },
  { label: "Locations", href: "/locations" },
  { label: "Stock Take", href: "/stock-take" },
  { label: "Production", href: "/production" },
  { label: "History", href: "/history" },
  { label: "Admin", href: "/admin" },
];
