import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-primary text-white py-4 shadow-md sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4">
        <Link href="/" className="text-2xl font-bold">AV 콘텐츠</Link>
        <nav className="space-x-4">
          <Link href="/category/한국야동" className="hover:text-accent">한국</Link>
          …  
        </nav>
      </div>
    </header>
  );
}
