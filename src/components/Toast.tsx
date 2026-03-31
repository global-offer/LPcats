import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastMessage key={t.id} item={t} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastMessage({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => setVisible(false), 2700)
    return () => clearTimeout(timer)
  }, [])

  const colors: Record<ToastType, string> = {
    success: 'bg-green-600/90',
    error: 'bg-red-600/90',
    warning: 'bg-yellow-500/90 text-black',
    info: 'bg-gray-700/90',
  }

  return (
    <div className={`pointer-events-auto px-5 py-3 rounded-lg text-sm font-medium text-white shadow-xl backdrop-blur-md border border-white/10 transition-all duration-300 ${colors[item.type]} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
      {item.message}
    </div>
  )
}
