import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/components/auth-provider";
import ClientProviders from "@/components/client-providers";
import NavigationBar from "@/components/navigation-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jiraibrary Catalog",
  description:
    "Discover Jirai Kei fashion items, search by brand or tag, and explore detailed references.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-transparent text-slate-900 antialiased`}
      >
        <ClientProviders>
          <AuthProvider>
            <div className="flex min-h-screen flex-col">
              <NavigationBar />
              <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
              <footer className="border-t border-rose-100/80 bg-white/75">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-sm text-rose-500">
                  <span>© {new Date().getFullYear()} Jiraibrary.</span>
                  <span>Curating Jirai Kei fashion references.</span>
                </div>
              </footer>
            </div>
          </AuthProvider>
        </ClientProviders>
      </body>
    </html>
  );
}
