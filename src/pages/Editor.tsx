import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLP, saveLP, uploadImage } from '../lib/api'
import { useToast } from '../components/Toast'
import DropZone from '../components/DropZone'
import StepList from '../components/StepList'
import CTAEditor from '../components/CTAEditor'
import SwipePreview from '../components/SwipePreview'
import type { LP, CTA } from '../types'

export default function Editor() {
  const { id } = useParams<{ id: string }>()
  const [lp, setLp] = useState<LP | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const { toast } = useToast()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const data = await getLP(id)
      setLp(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'LPが見つかりません', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const debouncedSave = useCallback((updated: LP) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        // 最新stepsを取得してマージ（stale reference防止）
        const fresh = await getLP(updated.id)
        await saveLP({ ...updated, steps: fresh.steps })
      } catch (err) {
        toast(err instanceof Error ? err.message : '保存に失敗', 'error')
      }
    }, 500)
  }, [toast])

  const updateLP = useCallback((patch: Partial<LP>) => {
    setLp(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...patch }
      debouncedSave(updated)
      return updated
    })
  }, [debouncedSave])

  const handleUpload = async (files: File[]) => {
    if (!lp) return
    setUploading(true)
    try {
      for (const file of files) {
        const result = await uploadImage(file)
        const fresh = await getLP(lp.id)
        const step = {
          id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          order: fresh.steps.length,
          image: result.path,
          fileName: result.fileName || file.name,
          createdAt: new Date().toISOString(),
        }
        fresh.steps.push(step)
        await saveLP(fresh)
      }
      await load()
      toast(`${files.length}枚アップロードしました`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'アップロードエラー', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleReorder = async (stepIds: string[]) => {
    if (!lp) return
    try {
      const fresh = await getLP(lp.id)
      const stepMap = Object.fromEntries(fresh.steps.map(s => [s.id, s]))
      fresh.steps = stepIds.map((sid, i) => {
        const s = stepMap[sid]
        if (s) s.order = i
        return s
      }).filter(Boolean) as LP['steps']
      await saveLP(fresh)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '並べ替えに失敗', 'error')
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!lp) return
    try {
      const fresh = await getLP(lp.id)
      fresh.steps = fresh.steps.filter(s => s.id !== stepId)
      fresh.steps.forEach((s, i) => { s.order = i })
      await saveLP(fresh)
      await load()
      toast('ステップを削除しました', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : '削除に失敗', 'error')
    }
  }

  const handleCTAChange = (cta: CTA) => {
    updateLP({ cta })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-9 h-9 border-3 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!lp) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-red-400 mb-2">LPが見つかりません</h2>
        <Link to="/" className="text-orange-400 hover:underline">LP一覧に戻る</Link>
      </div>
    )
  }

  const dirOptions = [
    { value: 'vertical', label: '縦', sub: 'TikTok風', icon: '↕' },
    { value: 'horizontal', label: '横', sub: 'Instagram風', icon: '↔' },
    { value: 'fullscreen', label: '全画面', sub: 'ECアプリ風', icon: '⬜' },
  ] as const

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← LP一覧に戻る</Link>
        <div className="flex items-center gap-3 mt-2">
          <input
            type="text"
            value={lp.title}
            onChange={e => updateLP({ title: e.target.value || '無題のLP' })}
            className="text-2xl font-bold bg-transparent border border-transparent hover:border-gray-700 focus:border-orange-500 rounded-lg px-2 py-1 outline-none transition-all w-full max-w-md"
          />
        </div>
        {/* タブ */}
        <div className="flex gap-1 border-b border-gray-800 mt-4">
          <Link to={`/editor/${lp.id}`} className="px-5 py-3 text-sm font-semibold text-orange-400 border-b-2 border-orange-500 bg-orange-500/5 rounded-t-lg">編集</Link>
          <Link to={`/editor/${lp.id}/analytics`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">分析</Link>
          <Link to={`/editor/${lp.id}/embed`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">埋め込み</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* メイン */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">ステップ管理</h3>
            <DropZone onFiles={handleUpload} />
            {uploading && (
              <div className="flex items-center gap-3 mt-3 px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
                <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                アップロード中...
              </div>
            )}
            <div className="mt-4">
              <StepList steps={lp.steps} onReorder={handleReorder} onDelete={handleDeleteStep} />
            </div>
          </div>
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          {/* LP名 */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">表示形式</h3>
            <div className="grid grid-cols-3 gap-2">
              {dirOptions.map(opt => (
                <label key={opt.value} className="cursor-pointer">
                  <input type="radio" name="direction" value={opt.value} checked={lp.direction === opt.value} onChange={() => updateLP({ direction: opt.value })} className="hidden" />
                  <div className={`flex flex-col items-center p-3 rounded-xl border-2 text-center transition-all ${
                    lp.direction === opt.value
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                      : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                  }`}>
                    <span className={`text-2xl mb-1 transition-transform ${lp.direction === opt.value ? 'scale-110' : ''}`}>{opt.icon}</span>
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-gray-500">{opt.sub}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">CTA設定</h3>
            <CTAEditor cta={lp.cta} onChange={handleCTAChange} />
          </div>

          {/* アクション */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-2">
            <button onClick={() => setShowPreview(true)} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 font-bold text-sm hover:shadow-lg hover:shadow-orange-500/20 transition-all">▶ プレビュー</button>
            <a href={`_old/viewer.html?id=${lp.id}`} target="_blank" rel="noopener noreferrer" className="block w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold text-sm text-center transition-colors">新しいタブで開く</a>
          </div>
        </div>
      </div>

      {showPreview && <SwipePreview lpId={lp.id} onClose={() => setShowPreview(false)} />}
    </div>
  )
}
