import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Green Remote Jobs",
  description:
    "Find remote climate, sustainability, and green tech jobs in one click.",
  verification: {
    google: "djU7Igm8eLuK2NTB78lUgqT9yHDYdyXfcEMvfJSh47I",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-zinc-950 text-zinc-100">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
