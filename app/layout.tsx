import type { Metadata } from "next";
import { Gantari } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const aveton = localFont({
  src: "../public/fonts/AvetonRegular-MARon.ttf",
  variable: "--font-aveton",
  display: "swap",
});

const sfcLaPura = localFont({
  src: "../public/fonts/SFC La Pura.ttf",
  variable: "--font-sfc-la-pura",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | AGILA CATalog",
    default: "AGILA CATalog",
  },
  description:
    "AGILA's cat census and management platform for Ateneo de Manila University.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${gantari.variable} ${aveton.variable} ${sfcLaPura.variable} antialiased`}
      >
        {children}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
