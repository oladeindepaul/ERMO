import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest"; // bundled locally so pages never wait on Google Fonts
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getMe } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "ERMO | Choose your carer directly", template: "%s | ERMO" },
  description: "Find verified, independent carers near you. See their checks, history and reviews, then book them directly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef2f9",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const me = await getMe();
  return (
    <html lang="en-GB" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Header me={me ? { role: me.role, name: me.full_name } : null} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
