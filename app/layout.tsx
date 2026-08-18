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

// Copy for share cards and search results. Leads with Ateneo — the term AGILA
// actually owns and ranks first for — and carries the geography in the body,
// where it still counts for location intent. Competing on "adopt a cat in
// Quezon City" against established Metro Manila shelters was never winnable.
const SHARE_DESCRIPTION =
  "Meet campus cats available for adoption and fostering, based at Ateneo de Manila University in Quezon City and open to adopters across Metro Manila.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | AGILA CATalog",
    default: "AGILA CATalog",
  },
  description: SITE_DESCRIPTION,
  // Share-card defaults live here, not on the home page, because `/` IS the
  // public catalog — and a page that declares its own `openGraph` replaces this
  // block wholesale, which silently drops the file-based opengraph-image along
  // with it. That is exactly how the site shipped a `summary_large_image` card
  // with no image. Only /catalog/[id] overrides these, and it brings its own
  // image (the cat's photo).
  openGraph: {
    type: "website",
    siteName: "AGILA CATalog",
    title: "Adopt a Cat from Ateneo",
    description: SHARE_DESCRIPTION,
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "Adopt a Cat from Ateneo",
    description: SHARE_DESCRIPTION,
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
