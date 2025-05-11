'use client'  
import Link from 'next/link'
import { categories } from '@/config/categories'

export default function CategoryNav() {
  return (
    <nav className="flex space-x-4 overflow-x-auto py-4 px-6">
      {categories.map(({ label, path }) => {
        const href = path ? `/category/${encodeURIComponent(path)}` : '/videos'
        return (
          <Link
            key={path}
            href={href}
            className="px-3 py-1 rounded hover:bg-gray-200"
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}