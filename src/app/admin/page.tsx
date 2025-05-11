'use client'

import React, { useState } from 'react'

export default function AdminPage() {
  const [title, setTitle] = useState<string>('')
  const [category, setCategory] = useState<string>('한국야동')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title || !category || !videoFile || !thumbFile) {
      setStatus('제목·카테고리·영상·썸네일을 모두 선택하세요.')
      return
    }

    try {
      const videoQuery = new URLSearchParams({
        fileName: videoFile.name,
        contentType: videoFile.type,
      })
      const res1 = await fetch(`/api/admin/upload-url?${videoQuery.toString()}`)
      if (!res1.ok) throw new Error('비디오 URL 발급 실패')
      const { url: videoUrl, key: videoKey } = await res1.json()

      const putRes1 = await fetch(videoUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoFile.type },
        body: videoFile,
        mode: 'cors',
      })
      if (!putRes1.ok) throw new Error('비디오 업로드 실패')

      const thumbQuery = new URLSearchParams({
        fileName: thumbFile.name,
        contentType: thumbFile.type,
      })
      const res2 = await fetch(`/api/admin/upload-url?${thumbQuery.toString()}`)
      if (!res2.ok) throw new Error('썸네일 URL 발급 실패')
      const { url: thumbUrl, key: thumbKey } = await res2.json()

      const putRes2 = await fetch(thumbUrl, {
        method: 'PUT',
        headers: { 'Content-Type': thumbFile.type },
        body: thumbFile,
        mode: 'cors',
      })
      if (!putRes2.ok) throw new Error('썸네일 업로드 실패')

      const res3 = await fetch('/api/admin/register-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, videoKey, thumbKey }),
      })
      if (!res3.ok) throw new Error('DB 등록 실패')

      setStatus('업로드 성공!')
      setTitle('')
      setCategory('한국야동')
      setVideoFile(null)
      setThumbFile(null)
    } catch (err: any) {
      console.error(err)
      setStatus(`오류: ${err.message}`)
    }
  }

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">관리자 업로드</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>영상 제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label>카테고리</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="한국야동">한국야동</option>
            <option value="일본야동">일본야동</option>
            <option value="서양야동">서양야동</option>
            <option value="중국야동">중국야동</option>
            <option value="애니야동">애니야동</option>
            <option value="BJ야동">BJ야동</option>
          </select>
        </div>

        <div>
          <label>영상 파일</label>
          <input
            type="file"
            accept="video/*"
            onChange={e => setVideoFile(e.target.files?.[0] || null)}
          />
        </div>

        <div>
          <label>썸네일 이미지</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => setThumbFile(e.target.files?.[0] || null)}
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded"
        >
          업로드
        </button>
      </form>

      {status && <p className="mt-4 text-red-600">{status}</p>}
    </main>
  )
}
