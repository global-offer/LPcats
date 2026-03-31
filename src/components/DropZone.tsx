import { useState, useCallback, useRef } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  maxSize?: number
  maxFiles?: number
}

export default function DropZone({ onFiles, accept = 'image/jpeg,image/png,image/webp', maxSize = 5 * 1024 * 1024, maxFiles = 20 }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList).filter(f => {
      if (!f.type.startsWith('image/')) return false
      if (f.size > maxSize) return false
      return true
    }).slice(0, maxFiles)
    if (files.length > 0) onFiles(files)
  }, [onFiles, maxSize, maxFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
        dragging
          ? 'border-orange-500 bg-orange-500/10 scale-[1.01]'
          : 'border-gray-700 hover:border-orange-500/50 hover:bg-orange-500/5'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
        className="hidden"
      />
      <div className="text-4xl mb-3 opacity-60">📷</div>
      <p className="text-gray-400 text-sm">画像をドラッグ&ドロップ、またはクリックして選択</p>
      <p className="text-gray-600 text-xs mt-1">JPEG / PNG / WebP（1枚5MB以下、最大20枚）</p>
    </div>
  )
}
