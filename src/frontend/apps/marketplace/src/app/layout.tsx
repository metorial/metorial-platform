import '../config';

import type { Metadata } from 'next';
import { JetBrains_Mono, Poppins } from 'next/font/google';
import { ClientLayout } from './clientLayout';
import './globals.css';
import './reset.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400']
});

export const metadata: Metadata = {
  title: 'Metorial Index',
  applicationName: 'Metorial',
  description: 'The open source integration platform for agentic AI.',
  metadataBase: new URL('https://metorial.com'),
  alternates: { canonical: '/' },
  openGraph: {
    images: { url: '/opengraph-image.jpg', alt: 'Metorial' },
    title: 'Metorial',
    siteName: 'Metorial',
    description: 'The open source integration platform for agentic AI.',
    type: 'website',
    locale: 'en_US',
    url: 'https://metorial.com'
  },
  twitter: {
    card: 'summary_large_image',
    site: '@metorial_ai',
    title: 'Metorial',
    description: 'The open source integration platform for agentic AI.',
    images: { url: '/twitter-image.jpg', alt: 'Metorial' }
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${jetbrainsMono.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
