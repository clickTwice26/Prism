import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_Bengali, Onest } from "next/font/google";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// Onest for Latin and Cyrillic; Noto Sans Bengali covers Bangla, which Onest lacks.
const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest", display: "swap" });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-bengali", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Prism — the same lesson for every learner", template: "%s · Prism" },
  description:
    "Prism makes one class lesson accessible to blind, deaf, dyslexic, autistic and other learners with special needs.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${onest.variable} ${bengali.variable}`} suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
