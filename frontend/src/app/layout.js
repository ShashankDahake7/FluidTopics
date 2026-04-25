import "./globals.css";
import Header from "@/components/layout/Header";

export const metadata = {
  title: "Fluid Topics — Content Delivery Platform",
  description: "Dynamic content delivery platform for searchable, personalized knowledge experiences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body data-gramm="false" data-gramm_editor="false" suppressHydrationWarning>
        <Header />
        {children}
      </body>
    </html>
  );
}
