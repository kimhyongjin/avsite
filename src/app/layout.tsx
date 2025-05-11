import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <header className="p-4 bg-gray-800 text-white">
          <nav className="flex space-x-4 max-w-7xl mx-auto">
            {['최신야동', '한국야동', 'BJ', '일본야동', '서양야동', '쇼츠야동', '애니야동'].map((cat) => (
              <Link key={cat} href={`/category/${cat}`} className="hover:underline">
                {cat}
              </Link>
            ))}
            <Link href="/" className="ml-auto hover:underline">
              전체
            </Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}