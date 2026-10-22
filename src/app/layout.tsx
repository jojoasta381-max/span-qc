import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/QueryProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "SpanQC — AI-Powered Wiring Diagram Quality Control",
  description:
    "Production-grade automated quality control for wiring diagrams and electrical schematics. Identify discrepancies, validate against IPC/WHMA-A-620 & UL 508A, and generate structured QC reports.",
  keywords: [
    "wiring diagram",
    "quality control",
    "wire harness",
    "IPC/WHMA-A-620",
    "UL 508A",
    "schematic verification",
    "electrical engineering",
    "automated QC",
  ],
  authors: [{ name: "Spandsons Horizon Engineering Pvt. Ltd." }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-[#070c18] text-slate-100 antialiased selection:bg-blue-600/30 selection:text-blue-200">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
