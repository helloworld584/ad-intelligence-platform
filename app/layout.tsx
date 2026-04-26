import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdIntel - 광고 성과를 데이터로 증명하세요",
  description: "업종별 벤치마크 비교, AI 캠페인 진단, 경쟁사 광고 패턴 분석으로 마케팅 ROI를 극대화하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="bg-[#0f1219]">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
