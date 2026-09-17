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

// Resolves the theme (stored choice, falling back to OS preference) and
// sets it on <html> before the page paints, so switching pages or reloading
// never flashes the wrong theme. CSS alone already handles a first-ever
// visit via `prefers-color-scheme`; this only matters once someone has an
// explicit stored choice that differs from their current OS preference.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('viswasimi-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}

        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}