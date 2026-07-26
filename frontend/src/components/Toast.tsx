import { useEffect } from 'react'

interface ToastProps {
  message: string
  onClose: () => void
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-4 py-3 rounded shadow-lg text-sm">
      {message}
    </div>
  )
}
