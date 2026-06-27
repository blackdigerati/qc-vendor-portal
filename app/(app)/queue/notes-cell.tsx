'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

export function NotesCell({ orderNumber, initial }: { orderNumber: string; initial: string }) {
  const [value, setValue] = useState(initial)
  const [committed, setCommitted] = useState(initial)
  const [saving, setSaving] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Keep in sync if a parent refresh ships a new value
  useEffect(() => {
    setValue(initial)
    setCommitted(initial)
  }, [initial])

  function autoSize(el: HTMLTextAreaElement) {
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  }

  async function save() {
    if (value === committed) return
    setSaving(true)
    const r = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: value }),
    })
    setSaving(false)
    if (!r.ok) {
      toast.error(`Could not save notes for #${orderNumber}`)
      setValue(committed)
      return
    }
    setCommitted(value)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setValue(committed)
      taRef.current?.blur()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      taRef.current?.blur()
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        placeholder="—"
        onChange={e => {
          setValue(e.target.value)
          autoSize(e.target)
        }}
        onFocus={e => autoSize(e.target)}
        onBlur={save}
        onKeyDown={onKeyDown}
        className="
          w-full min-h-[24px] resize-none bg-transparent
          text-[13px] text-slate-700 placeholder:text-slate-400
          rounded px-1.5 py-0.5 -mx-1.5
          border border-transparent hover:bg-white hover:border-slate-200
          focus:bg-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200
          transition-colors
        "
      />
      {saving && (
        <span className="absolute right-1 top-0.5 text-[10px] text-slate-400 italic">saving…</span>
      )}
    </div>
  )
}
