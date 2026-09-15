import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import TopStatusBar from "@/components/layout/TopStatusBar";
import TabNav from "@/components/layout/TabNav";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HighwayLab — Geometric Design & Traffic Operations Workstation",
  description:
    "Enterprise highway geometric design, traffic operations, and earthwork engineering workstation — AASHTO Green Book / HCM / TxDOT RDM compliant.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body className="min-h-screen bg-surface-0 text-text-primary antialiased">
        <div className="flex h-screen flex-col overflow-hidden">
          <TopStatusBar />
          <TabNav />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
