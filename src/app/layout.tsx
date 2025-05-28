import './globals.css';
import React from 'react';
import Header from '@/components/Header';

export const metadata = {
  title: 'AVKOREA',
  description: 'AV 콘텐츠 모아보기',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="bg-gray-50 min-h-screen">
      <body className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto p-6 bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}