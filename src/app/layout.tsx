import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { MaintenanceProvider } from "@/components/providers/MaintenanceProvider";
import { MainContent } from "@/components/layout-wrapper/MainContent";
import Script from "next/script";


const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Streamlet | Crypto Faucet & Rewards",
  description: "Play games, claim faucet and earn real crypto rewards instanly to FaucetPay.",
  verification: {
    other: {
      "6a97888e-site-verification": "87f1ba96ba15185e71d9f63ff4fccdb2",
      "bitmedia-site-verification": "6cfe840eda692a57488bcaef3c37e272",
      "coinzilla": "1c65bc05c46e193a73605b590404e8e4",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Popunder Ad Script */}
        <Script 
          src="https://pl29698487.effectivecpmnetwork.com/66/c3/59/66c3592296a5a47dfcc56ad2915c624d.js"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <MaintenanceProvider>
            <MainContent>
              {children}
            </MainContent>
          </MaintenanceProvider>
          <Toaster position="bottom-right" theme="dark" expand={false} richColors />
        </AuthProvider>
      </body>
    </html>
  );
}

