import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://market-structures.mekdigital.chatgpt.site'),
  title: 'Market Structures — Data Structures for Low Latency',
  description:
    'An interactive, evidence-first guide to data structures, performance, and HFT systems.',
  openGraph: {
    title: 'Market Structures — Data Structures for Low Latency',
    description:
      'An interactive, evidence-first guide to data structures, performance, and HFT systems.',
    url: '/',
    siteName: 'Market Structures',
    images: [
      {
        url: '/og.png',
        width: 1672,
        height: 941,
        alt: 'Market Structures: Data Structures for Low Latency',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Structures — Data Structures for Low Latency',
    description:
      'An interactive, evidence-first guide to data structures, performance, and HFT systems.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
