import "./globals.css";

export const metadata = { title: "PhD Outreach", description: "Track professor emails, replies and next steps" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f5f2" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
