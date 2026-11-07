import type { Metadata, Viewport } from "next";
import { Calistoga, Inter } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const display = Calistoga({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-calistoga",
});

export const metadata: Metadata = {
  title: "Brief",
  description: "Overnight social listening for marketing teams. Follow the profiles you choose and read what they said in the morning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8e4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-xl focus:bg-card focus:px-4 focus:py-3 focus:outline-2 focus:outline-ring"
        >
          Skip to content
        </a>
        <AppProviders dataSuffix={process.env.CELO_DATA_SUFFIX ?? null}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
