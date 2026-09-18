import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { COLORS } from "@/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MedhOrbit | Learn Smarter. Grow Brighter.",
  description:
    "Discover MedhOrbit’s approach to AI-powered worksheets, quizzes, and learning tools for students, parents, and teachers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className={`flex min-h-dvh flex-col ${COLORS.background} ${COLORS.text.primary}`}
      >
        {children}
      </body>
    </html>
  );
}
