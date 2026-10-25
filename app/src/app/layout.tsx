import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { ConfigNotice } from "@/components/config-notice";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const description =
  "Own a share of real, profitable businesses and get paid dividends in USDC. Tokenized private equity on Stellar.";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "dvdnd.vercel.app"}`),
  title: { default: "dvdnd", template: "%s · dvdnd" },
  description,
  openGraph: { title: "dvdnd", description, siteName: "dvdnd", type: "website" },
  twitter: { card: "summary_large_image", title: "dvdnd", description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>
        <WalletProvider>
          <ConfigNotice />
          <Nav />
          {children}
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
