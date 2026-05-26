import type { Metadata } from "next";
import { Gantari } from "next/font/google";
import "./globals.css";

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | AGILA CATalog",
    default: "AGILA CATalog",
  },
  description: "AGILA's cat census and management platform for Ateneo de Manila University.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script src="https://accounts.google.com/gsi/client" async></script>
      <html lang="en">
        <body className={`${gantari.variable} antialiased`}>{children}</body>
      </html>
    </>
  );
}
