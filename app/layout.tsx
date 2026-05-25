import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ascii video thingy",
  description: "Halftone-dither image and video generator. Bring your own model keys.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
