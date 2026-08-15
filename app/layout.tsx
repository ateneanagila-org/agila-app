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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_DESCRIPTION =
  "Cat census and adoption catalog for AGILA at Ateneo de Manila University, Quezon City.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | AGILA CATalog",
    default: "AGILA CATalog",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "AGILA CATalog",
    title: "AGILA CATalog",
    description: SITE_DESCRIPTION,
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "AGILA CATalog",
    description: SITE_DESCRIPTION,
  },
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
