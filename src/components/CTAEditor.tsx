import { useState, useRef } from 'react'
import type { CTA } from '../types'
import { uploadImage } from '../lib/api'
import { useToast } from './Toast'

interface CTAEditorProps {
  cta: CTA
  onChange: (cta: CTA) => void
}

export default function CTAEditor({ cta, onChange }: CTAEditorProps) {
  const [ctaType, setCtaType] = useState<'text' | 'image'>(cta.image ? 'image' : 'text')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const update = (patch: Partial<CTA>) => {
    onChange({ ...cta, ...patch })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await uploadImage(file)
      update({ image: result.path })
      toast('CTA画像をアップロードしました', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'アップロードエラー', 'error')
    }
    e.target.value = ''
  }

  const isSafeURL = (url: string) => {
    try {
      const p = new URL(url)
      return ['http:', 'https:', 'tel:', 'mailto:'].includes(p.protocol)
    } catch { return false }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">CTAタイプ</label>
        <select
          value={ctaType}
          onChange={e => {
            const v = e.target.value as 'text' | 'image'
            setCtaType(v)
            if (v === 'text') update({ image: undefined })
          }}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 outline-none transition-all"
        >
          <option value="text">テキストボタン</option>
          <option value="image">画像ボタン</option>
        </select>
      </div>

      {ctaType === 'text' ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">ボタンテキスト</label>
            <input
              type="text"
              value={cta.text}
              onChange={e => update({ text: e.target.value })}
              placeholder="今すぐ申し込む"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 outline-none transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">ボタン色</label>
              <input type="color" value={cta.bgColor} onChange={e => update({ bgColor: e.target.value })} className="w-full h-10 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">文字色</label>
              <input type="color" value={cta.textColor} onChange={e => update({ textColor: e.target.value })} className="w-full h-10 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer" />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">CTA画像（推奨: 750x260px）</label>
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500/50 transition-colors min-h-[80px] flex items-center justify-center">
            {cta.image ? (
              <img src={cta.image} alt="CTA" className="max-w-full max-h-28 rounded-lg" />
            ) : (
              <span className="text-gray-600 text-sm">クリックして画像を選択</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">リンク先URL</label>
        <input
          type="url"
          value={cta.url}
          onChange={e => update({ url: e.target.value })}
          placeholder="https://example.com"
          className={`w-full px-3 py-2 rounded-lg bg-gray-800 border text-sm focus:ring-2 outline-none transition-all ${
            cta.url && !isSafeURL(cta.url)
              ? 'border-red-500 focus:ring-red-500/30'
              : 'border-gray-700 focus:border-orange-500 focus:ring-orange-500/30'
          }`}
        />
      </div>

      {/* プレビュー */}
      <div className="rounded-xl bg-black/30 p-4">
        {cta.image ? (
          <img src={cta.image} alt="CTA Preview" className="w-full rounded-xl" />
        ) : (
          <div className="w-full py-4 rounded-xl text-center font-bold text-lg" style={{ backgroundColor: cta.bgColor, color: cta.textColor }}>
            {cta.text || 'CTAボタン'}
          </div>
        )}
      </div>
    </div>
  )
}
