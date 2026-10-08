import "./globals.css";

export const metadata = {
  title: "Cricket News Scraper",
  description: "Extract recent cricket articles from board, league and franchise news pages",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
