import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Predictable",
  description: "Back-office de gestion de marches de prediction"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
