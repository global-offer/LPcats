import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLP } from '../lib/api'
import { useToast } from '../components/Toast'
import type { LP } from '../types'

export default function Embed() {
  const { id } = useParams<{ id: string }>()
  const [lp, setLp] = useState<LP | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setLp(await getLP(id))
    } catch (err) {
      toast(err instanceof Error ? err.message : '読み込みエラー', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-9 h-9 border-3 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!lp) return null

  const baseUrl = window.location.origin + window.location.pathname.replace(/(index\.html)?#.*$/, '')
  const embedTag = `<script src="${baseUrl}api/embed.php?id=${lp.id}"><\/script>`
  const embedTagMobile = `<script src="${baseUrl}api/embed.php?id=${lp.id}&mobile=1"><\/script>`
  const viewerUrl = `${baseUrl}_old/viewer.html?id=${lp.id}`

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('コピーしました', 'success')
    } catch {
      toast('コピーに失敗しました', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← LP一覧に戻る</Link>
        <h2 className="text-2xl font-bold mt-2">{lp.title}</h2>
        <div className="flex gap-1 border-b border-gray-800 mt-4">
          <Link to={`/editor/${lp.id}`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">編集</Link>
          <Link to={`/editor/${lp.id}/analytics`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">分析</Link>
          <Link to={`/editor/${lp.id}/embed`} className="px-5 py-3 text-sm font-semibold text-orange-400 border-b-2 border-orange-500 bg-orange-500/5 rounded-t-lg">埋め込み</Link>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">埋め込みタグ</h3>
          <p className="text-gray-400 text-sm mb-5">以下のタグを表示させたいページのHTMLに貼り付けてください。</p>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">全デバイス表示</label>
              <div className="flex gap-2">
                <code className="flex-1 block px-4 py-3 bg-black border border-gray-800 rounded-lg text-green-400 font-mono text-xs break-all">{embedTag}</code>
                <button onClick={() => copy(embedTag)} className="shrink-0 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold transition-colors">コピー</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">スマホのみ表示（画面幅767px以下）</label>
              <div className="flex gap-2">
                <code className="flex-1 block px-4 py-3 bg-black border border-gray-800 rounded-lg text-green-400 font-mono text-xs break-all">{embedTagMobile}</code>
                <button onClick={() => copy(embedTagMobile)} className="shrink-0 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold transition-colors">コピー</button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">直接リンク</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">ビューアーURL</label>
            <div className="flex gap-2">
              <code className="flex-1 block px-4 py-3 bg-black border border-gray-800 rounded-lg text-green-400 font-mono text-xs break-all">{viewerUrl}</code>
              <button onClick={() => copy(viewerUrl)} className="shrink-0 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold transition-colors">コピー</button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">設置方法</h3>
          <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
            <li>上のタグをコピー</li>
            <li>LPを表示させたいページのHTMLを開く</li>
            <li>表示させたい位置にタグを貼り付け</li>
            <li>保存してページを表示 → スワイプ型LPが出現</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
