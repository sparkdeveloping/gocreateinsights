import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoCreate Insight Studio",
  description: "Animated member intelligence and engagement dashboard for GoCreate.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
