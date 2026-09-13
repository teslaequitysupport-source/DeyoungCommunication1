import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Typography system (two typefaces per the design spec): Space Grotesk for
// display headlines, Inter for body copy, labels, forms and controls.
// Loaded at build time by next/font (no runtime font requests).
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VoxCore — Real-Time AI Voice Conversion",
  description:
    "Speak into your microphone and hear a converted voice come back in real time. A worker fleet, a self-healing scheduler, open model uploads with human moderation, and a scale-to-zero cost model. Every number shown is measured, never marketed.",
  keywords: ["voice conversion", "real-time", "AI voice", "RVC", "streaming audio"],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "VoxCore — Real-Time AI Voice Conversion",
    description: "Real-time voice conversion with measured latency, honest capability labels, and open uploads under human review.",
    siteName: "VoxCore",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${grotesk.variable} ${inter.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
