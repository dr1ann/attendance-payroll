import { useEffect } from 'react'
import Button from './Button'
import Icon from './Icon'

export default function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  busy = false,
  hideFooter = false,
}) {
  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose} role="presentation">
      <section className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal" icon={<Icon name="close" />} className="!p-2" />
        </header>

        <div className="p-4">{children}</div>

        {!hideFooter ? (
          <footer className="flex justify-end gap-2 p-4 border-t border-gray-200">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button variant={confirmVariant} onClick={onConfirm} disabled={busy}>
              {busy ? 'Processing...' : confirmLabel}
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  )
}
