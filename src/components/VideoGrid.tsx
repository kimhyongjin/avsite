'use client';

import Link from 'next/link';
import SearchBar from './SearchBar';
import CategoryNav from './CategoryNav';

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white shadow">
      {/* ── 1st row: logo, search, contact ── */}
      <div className="max-w-6xl mx-auto flex items-center px-4 py-3 space-x-4">
        {/* logo / home */}
        <Link href="/" className="flex items-center space-x-3">
          {/* 로고 SVG */}
          <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="url(#logo-gradient)" />
            <text
              x="50%"
              y="54%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="36"
              fontWeight="bold"
              fill="#fff"
            >
              AV
            </text>
          </svg>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-extrabold text-gray-800">
              AVKOREA
            </span>
            <span className="text-sm font-medium text-gray-500">
              Premium
            </span>
          </div>
        </Link>

        {/* 검색창 */}
        <div className="flex-1 max-w-lg">
          <SearchBar />
        </div>

        {/* 텔레그램 문의 링크 */}
        <Link
          href="https://t.me/dotoriman"
          target="_blank"
          className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-800"
        >
          {/* 텔레그램 로고 */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 240 240" fill="none">
            <circle cx="120" cy="120" r="120" fill="#0088cc" />
            <path d="M179 66L82 119l29 9 6 49 12-36 58-50-96 74" fill="white" />
          </svg>
          <span>접속 차단시 실시간 업데이트</span>
        </Link>
      </div>

      {/* ── 2nd row: category tabs ── */}
      <div className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2 overflow-x-auto">
          <CategoryNav />
        </div>
      </div>
    </header>
  );
}
