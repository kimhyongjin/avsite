'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Live cams, Games만 external 링크로 처리하는 탭 배열
const tabs: { name: string; href: string; external?: boolean }[] = [
  { name: '최신야동',   href: '/category/최신야동' },
  { name: '한국야동',   href: '/category/한국야동' },
  { name: 'BJ야동',     href: '/category/BJ야동' },
  { name: '일본야동',   href: '/category/일본야동' },
  { name: '서양야동',   href: '/category/서양야동' },
  { name: '쇼츠야동',   href: '/category/쇼츠야동' },
  { name: '애니야동',   href: '/category/애니야동' },
  { name: 'Live cams',  href: 'https://www.xvlivecams.com/', external: true },
  { name: 'Games',      href: 'https://xvideos.nutaku.net/',   external: true },
]

export default function CategoryNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-200 bg-transparent">
      <div className="max-w-7xl mx-auto flex justify-evenly px-6 py-3">
        {tabs.map((tab) => {
          const isInternal = !tab.external
          const isActive   = isInternal && pathname === tab.href

          if (tab.external) {
            // 외부 링크: <a> 태그, 새 탭 열기
            return (
              <a
                key={tab.name}
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap font-medium text-lg text-gray-600 hover:text-gray-800"
              >
                {tab.name}
              </a>
            )
          }

          // 내부 링크: next/link
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                whitespace-nowrap font-medium text-lg
                ${isActive
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
                }
              `}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}