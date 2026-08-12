import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena",
  description:
    "A live, multi-model coding benchmark. Every submission runs for real before it gets a score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
