import type { LP, AnalyticsData, UploadResult } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    try {
      const err = JSON.parse(text)
      throw new Error(err.error || `APIエラー (${res.status})`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('APIエラー')) throw e
      throw new Error(`APIエラー (${res.status})`)
    }
  }
  return res.json()
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function getAllLPs(): Promise<LP[]> {
  return fetchJSON<LP[]>(`${API_BASE}/load.php?action=list`)
}

export async function getLP(id: string): Promise<LP> {
  return fetchJSON<LP>(`${API_BASE}/load.php?action=get&id=${encodeURIComponent(id)}`)
}

export async function createLP(title: string): Promise<LP> {
  const id = generateId('lp')
  const now = new Date().toISOString()
  const lp: LP = {
    id,
    title: title || '新規LP',
    direction: 'vertical',
    cta: { text: '今すぐ申し込む', url: 'https://example.com', bgColor: '#FF6B35', textColor: '#FFFFFF' },
    steps: [],
    createdAt: now,
    updatedAt: now,
  }
  const result = await fetchJSON<{ lp: LP }>(`${API_BASE}/save.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lp),
  })
  return result.lp || lp
}

export async function saveLP(lp: LP): Promise<LP> {
  lp.updatedAt = new Date().toISOString()
  const result = await fetchJSON<{ lp: LP }>(`${API_BASE}/save.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lp),
  })
  return result.lp || lp
}

export async function deleteLP(id: string): Promise<void> {
  await fetchJSON(`${API_BASE}/save.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, _delete: true }),
  })
}

export async function uploadImage(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`${API_BASE}/upload.php`, { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text()
    try {
      const err = JSON.parse(text)
      throw new Error(err.error || 'アップロードエラー')
    } catch (e) {
      if (e instanceof Error && e.message.includes('アップロード')) throw e
      throw new Error(`アップロードエラー (${res.status})`)
    }
  }
  return res.json()
}

export async function getAnalytics(lpId: string): Promise<AnalyticsData> {
  return fetchJSON<AnalyticsData>(`${API_BASE}/analytics.php?id=${encodeURIComponent(lpId)}`)
}
