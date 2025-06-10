'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function SearchBar() {
  const [q, setQ] = useState('')
  const router = useRouter()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/?search=${encodeURIComponent(q)}&page=1`)
  }

  return (
    <form onSubmit={onSubmit} className="flex">
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.currentTarget.value)}
        placeholder="검색어를 입력하세요"
        className="w-full px-3 py-2 border rounded-l border-gray-300 bg-white placeholder-gray-400 focus:outline-none focus:ring focus:border-blue-500"
      />
      <button
        type="submit"
        className="rounded-r bg-blue-600 px-4 flex items-center justify-center text-white"
      >
        <Search size={20} />
      </button>
    </form>
  )
}