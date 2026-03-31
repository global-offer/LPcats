import { useEffect, useState } from 'react'

interface SwipePreviewProps {
  lpId: string
  onClose: () => void
}

export default function SwipePreview({ lpId, onClose }: SwipePreviewProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const viewerUrl = `_old/viewer.html?id=${encodeURIComponent(lpId)}`

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded-t-xl">
          <span className="font-semibold text-sm">LP プレビュー</span>
          <div className="flex gap-2">
            <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">新しいタブで開く</a>
            <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">✕ 閉じる</button>
          </div>
        </div>
        <div className="flex justify-center p-5 bg-black rounded-b-xl">
          <div className="w-[375px] h-[667px] border-[6px] border-gray-600 rounded-[20px] overflow-hidden bg-black">
            <iframe src={viewerUrl} className="w-full h-full border-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
