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
  title: 'Metorial Connect',
  description: 'Instantly deploy thousands of MCP servers.'
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
