import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SDR Metrics",
  description: "Goals, benchmarks, and meeting tracking for SDR teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
