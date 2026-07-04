import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phản Xạ Tiếng Trung - Học tập cá nhân",
  description: "Ứng dụng luyện phản xạ điền từ tiếng Trung offline và online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
