import { useState, useCallback } from 'react'
import type { Step } from '../types'

interface StepListProps {
  steps: Step[]
  onReorder: (stepIds: string[]) => void
  onDelete: (stepId: string) => void
}

export default function StepList({ steps, onReorder, onDelete }: StepListProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const sorted = [...steps].sort((a, b) => a.order - b.order)

  const move = useCallback((from: number, dir: number) => {
    const to = from + dir
    if (to < 0 || to >= sorted.length) return
    const ids = sorted.map(s => s.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    onReorder(ids)
  }, [sorted, onReorder])

  if (sorted.length === 0) {
    return <p className="text-center text-gray-600 py-8">画像をアップロードしてステップを追加</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((step, i) => (
        <div
          key={step.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => { e.preventDefault() }}
          onDrop={() => {
            if (dragIdx !== null && dragIdx !== i) {
              const ids = sorted.map(s => s.id)
              const [moved] = ids.splice(dragIdx, 1)
              ids.splice(i, 0, moved)
              onReorder(ids)
            }
            setDragIdx(null)
          }}
          onDragEnd={() => setDragIdx(null)}
          className={`grid grid-cols-[32px_32px_80px_1fr_auto] items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 ${
            dragIdx === i
              ? 'opacity-50 border-orange-500 bg-gray-800'
              : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/50'
          }`}
        >
          <div className="text-gray-600 cursor-grab active:cursor-grabbing text-center select-none">☰</div>
          <div className="text-sm font-bold text-gray-500 text-center">{i + 1}</div>
          <div className="w-20 h-12 rounded overflow-hidden bg-black">
            <img src={step.image} alt={step.fileName} className="w-full h-full object-cover" />
          </div>
          <div className="text-sm text-gray-400 truncate">{step.fileName}</div>
          <div className="flex gap-1">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === sorted.length - 1} className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">▼</button>
            <button onClick={() => onDelete(step.id)} className="px-2 py-1 text-xs rounded bg-red-900/50 hover:bg-red-800 text-red-400 transition-colors">✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
