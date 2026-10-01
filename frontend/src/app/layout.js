import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// CartProvider is a NAMED export (`export function CartProvider`), so it must be
// imported with braces. Importing it as a default silently gives `undefined`,
// which React then reports as "Element type is invalid" on every single page.
import { CartProvider } from "../components/CartProvider";
// AuthProvider wraps the app so the header, checkout and admin link can all see
// who is signed in. It must sit INSIDE CartProvider or the other way round —
// either is fine — but it must be above {children} so every page can use it.
import { AuthProvider } from "../components/AuthProvider";

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
            cart page would each hold their own separate cart. The auth provider
            wraps the cart so the header can show who is signed in. */}
        <CartProvider>
          <AuthProvider>{children}</AuthProvider>
        </CartProvider>
      </body>
    </html>
  );
}
