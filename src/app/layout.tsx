import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3D Country RAG Globe",
  description:
    "Select countries on a 3D globe and ask structured strategic questions grounded in local RAG files.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
