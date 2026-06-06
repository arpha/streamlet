import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { MainContent } from "@/components/layout-wrapper/MainContent";

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
        <AuthProvider>
          <MainContent>
            {children}
          </MainContent>
          <Toaster position="bottom-right" theme="dark" expand={false} richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
