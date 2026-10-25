import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
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

export const metadata: Metadata = {
  title: "dvdnd",
  description:
    "Own a share of real, profitable businesses and get paid dividends in USDC. Tokenized private equity on Stellar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${jetbrains.variable}`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
