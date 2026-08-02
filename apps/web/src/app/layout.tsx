// @ts-ignore
import 'katex/dist/katex.min.css';

// @ts-ignore
import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Viswasimi",
  description: "AI-powered tutor for students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 🚨 ADD THIS HEAD SECTION 🚨 */}
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" 
        />
      </head>
      
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