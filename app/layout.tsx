import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toptal SDR Engine",
  description: "Systematic Enterprise SDR workflow for Toptal account outreach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F9FAFB] text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
