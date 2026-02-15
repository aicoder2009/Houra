import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Houra",
  description: "Student-first service hour tracking with an autonomous Agent",
  applicationName: "Houra",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={geist.variable}>
        <body className={`${sora.variable} ${mono.variable} antialiased`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
