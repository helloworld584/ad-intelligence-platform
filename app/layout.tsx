import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Analytics Dashboard",
  description: "Premium SaaS analytics dashboard with metric cards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="bg-[#1a1f2e]">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
