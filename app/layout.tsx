import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operations Platform",
  description: "Phase 1 architecture scaffold for operations workflows.",
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
