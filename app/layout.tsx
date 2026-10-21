import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadSpace · 发现、阅读、记住",
  description: "为四级备考打造的英文阅读空间。逐步理解文章，收藏词句，让每次阅读都有收获。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
