import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLP, getAnalytics } from '../lib/api'
import { useToast } from '../components/Toast'
import type { LP, AnalyticsData } from '../types'

export default function Analytics() {
  const { id } = useParams<{ id: string }>()
  const [lp, setLp] = useState<LP | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [lpData, analyticsData] = await Promise.all([getLP(id), getAnalytics(id)])
      setLp(lpData)
      setData(analyticsData)
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

  if (!lp || !data) return null

  const hasData = data.computed && data.computed.length > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← LP一覧に戻る</Link>
        <h2 className="text-2xl font-bold mt-2">{lp.title}</h2>
        <div className="flex gap-1 border-b border-gray-800 mt-4">
          <Link to={`/editor/${lp.id}`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">編集</Link>
          <Link to={`/editor/${lp.id}/analytics`} className="px-5 py-3 text-sm font-semibold text-orange-400 border-b-2 border-orange-500 bg-orange-500/5 rounded-t-lg">分析</Link>
          <Link to={`/editor/${lp.id}/embed`} className="px-5 py-3 text-sm font-semibold text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-t-lg transition-colors">埋め込み</Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'セッション数', value: data.summary.totalSessions },
          { label: 'CTAクリック', value: data.summary.totalCtaClicks },
          { label: 'CTAクリック率', value: `${data.summary.ctaClickRate}%` },
        ].map(kpi => (
          <div key={kpi.label} className="relative rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-orange-300" />
            <div className="text-3xl font-black text-orange-400 tabular-nums">{kpi.value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {hasData ? (
        <>
          {/* ファネル */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
            <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">ファネル</h3>
            <div className="flex flex-col items-center gap-1">
              {data.computed.map(step => (
                <div key={step.index} className="flex items-center gap-3 w-full max-w-lg">
                  <span className="text-xs text-gray-500 w-16 text-right">Step {step.index + 1}</span>
                  <div className="flex-1">
                    <div
                      className="h-9 rounded-lg bg-gradient-to-r from-orange-600 to-orange-400 flex items-center justify-end pr-3 text-xs font-bold text-white transition-all duration-500"
                      style={{ width: `${Math.max(step.reachRate, 8)}%` }}
                    >
                      {step.reachRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* テーブル */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
            <h3 className="font-bold text-sm mb-4 pb-3 border-b border-gray-800">ステップ分析</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="text-left py-3 px-3">ステップ</th>
                    <th className="text-left py-3 px-3">閲覧数</th>
                    <th className="text-left py-3 px-3">到達率</th>
                    <th className="text-left py-3 px-3">離脱率</th>
                    <th className="text-left py-3 px-3">平均滞在</th>
                    <th className="text-left py-3 px-3">CTAクリック</th>
                    <th className="text-left py-3 px-3">CTAクリック率</th>
                  </tr>
                </thead>
                <tbody>
                  {data.computed.map(step => (
                    <tr key={step.index} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold">Step {step.index + 1}</td>
                      <td className="py-3 px-3">{step.views}</td>
                      <td className={`py-3 px-3 relative ${step.reachRate < 20 ? 'text-red-400' : step.reachRate < 50 ? 'text-yellow-400' : ''}`}>
                        <div className="absolute inset-0 bg-green-500/10 rounded" style={{ width: `${step.reachRate}%` }} />
                        <span className="relative">{step.reachRate}%</span>
                      </td>
                      <td className={`py-3 px-3 relative ${step.dropRate > 30 ? 'text-red-400 font-semibold' : step.dropRate > 15 ? 'text-yellow-400' : ''}`}>
                        <div className="absolute inset-0 bg-red-500/10 rounded" style={{ width: `${Math.min(step.dropRate, 100)}%` }} />
                        <span className="relative">{step.dropRate}%</span>
                      </td>
                      <td className="py-3 px-3 text-gray-400">{step.avgDurationFormatted}</td>
                      <td className="py-3 px-3">{step.ctaClicks}</td>
                      <td className="py-3 px-3">{step.ctaClickRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI基準 */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="font-bold text-sm mb-3 pb-3 border-b border-gray-800">KPI基準</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><strong className="text-gray-300">2ステップ目到達率</strong>: 60%が理想（50%以下ならFV改善が最優先）</li>
              <li><strong className="text-gray-300">最終ステップ到達率</strong>: 20%が目標ライン</li>
              <li><strong className="text-gray-300">各ステップ離脱率</strong>: 10%以上で改善対象</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-16 text-center bg-orange-500/5">
          <div className="text-6xl mb-4 opacity-60 animate-float">📊</div>
          <h3 className="text-xl font-bold mb-2">まだ分析データがありません</h3>
          <p className="text-gray-500">LPを埋め込んでアクセスが発生すると、ここにデータが表示されます。</p>
        </div>
      )}
    </div>
  )
}
