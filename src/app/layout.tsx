import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { AppProvider } from "@/lib/settings";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: "Beacon — accessible campus navigation",
  description: "Find step-free routes, avoid obstacles, and help map campus accessibility. A brighter way forward.",
  applicationName: "Beacon",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070B18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <AppProvider>
          <div className="app-frame">
            {children}
            <BottomNav />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
