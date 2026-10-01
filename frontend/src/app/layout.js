import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// CartProvider is a NAMED export (`export function CartProvider`), so it must be
// imported with braces. Importing it as a default silently gives `undefined`,
// which React then reports as "Element type is invalid" on every single page.
import { CartProvider } from "../components/CartProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Phone shop",
  description:
    "Answer a few questions and our model finds the phone that fits you best.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The cart must wrap every page, otherwise the header count and the
            cart page would each hold their own separate cart. */}
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
