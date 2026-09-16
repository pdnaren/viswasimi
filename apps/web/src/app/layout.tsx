// @ts-ignore
import 'katex/dist/katex.min.css';

// @ts-ignore
import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://viswasimi.com"),
  title: {
    default: "Viswasimi",
    template: "%s · Viswasimi",
  },
  description: "AI-powered tutor for students in Classes 6–12 and competitive exams like JEE and NEET.",
  icons: {
    icon: "/viswasimi-mark.svg",
    shortcut: "/viswasimi-mark.svg",
    apple: "/viswasimi-mark.svg",
  },
  openGraph: {
    title: "Viswasimi",
    description: "AI-powered tutor for students in Classes 6–12 and competitive exams like JEE and NEET.",
    siteName: "Viswasimi",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Viswasimi",
    description: "AI-powered tutor for students in Classes 6–12 and competitive exams like JEE and NEET.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload" 
        />
      </body>
    </html>
  );
}