import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIDashboard",
  description: "AI Department Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
