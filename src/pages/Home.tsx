import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllLPs, createLP, deleteLP } from '../lib/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import type { LP } from '../types'

export default function Home() {
  const [lps, setLps] = useState<LP[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllLPs()
      setLps(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : '読み込みエラー', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const title = prompt('LP名を入力してください:', '新規LP')
    if (title === null) return
    try {
      const lp = await createLP(title.trim() || '新規LP')
      toast('LPを作成しました', 'success')
      nav(`/editor/${lp.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : '作成に失敗', 'error')
    }
  }

  const handleDelete = async (lp: LP) => {
    const ok = await confirm({
      title: 'LPの削除',
      message: `「${lp.title}」を削除しますか？この操作は取り消せません。`,
      confirmLabel: '削除',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteLP(lp.id)
      toast('LPを削除しました', 'success')
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '削除に失敗', 'error')
    }
  }

  const dirLabels: Record<string, string> = { vertical: '縦スワイプ', horizontal: '横スワイプ', fullscreen: '全画面' }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">LPcats</h1>
        <p className="text-gray-500 text-sm mt-1">スワイプ型LP作成ツール</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <button onClick={handleCreate} className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 font-bold text-sm hover:shadow-lg hover:shadow-orange-500/20 hover:-translate-y-0.5 transition-all active:translate-y-0">
          + 新規LP作成
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="h-44 bg-gray-800 animate-shimmer bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-2/3 animate-shimmer bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800" />
                <div className="h-3 bg-gray-800 rounded w-1/2 animate-shimmer bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : lps.length === 0 ? (
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-16 text-center bg-orange-500/5">
          <div className="text-6xl mb-4 opacity-60 animate-float">📄</div>
          <h3 className="text-xl font-bold mb-2">LPがまだありません</h3>
          <p className="text-gray-500">「新規LP作成」ボタンでスワイプ型LPを作成しましょう</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {lps.map(lp => (
            <div key={lp.id} className="group rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50 hover:border-orange-500/30 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300">
              <div className="h-44 bg-black overflow-hidden">
                {lp.steps.length > 0 && lp.steps[0].image ? (
                  <img src={lp.steps[0].image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700 text-sm">No Image</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold truncate mb-1">{lp.title}</h3>
                <div className="flex gap-3 text-xs text-gray-500 mb-4">
                  <span>{dirLabels[lp.direction] || '縦スワイプ'}</span>
                  <span>{lp.steps.length}ステップ</span>
                  <span>{new Date(lp.updatedAt).toLocaleDateString('ja-JP')}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => nav(`/editor/${lp.id}`)} className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold transition-colors">編集</button>
                  <button onClick={() => nav(`/editor/${lp.id}/analytics`)} className="py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">分析</button>
                  <button onClick={() => window.open(`_old/viewer.html?id=${lp.id}`, '_blank')} className="py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-colors">表示</button>
                  <button onClick={() => handleDelete(lp)} className="py-2 px-3 rounded-lg bg-red-900/40 hover:bg-red-800 text-red-400 text-xs transition-colors">削除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
