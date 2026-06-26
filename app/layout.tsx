import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hector Egger Operations",
  description: "Workforce operations platform for Hector Egger NZ — timesheets, approvals, stock take, and production tracking.",
  icons: {
    icon: [
      {
        url: "/icons/app-icon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: ["/icons/app-icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
