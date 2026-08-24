import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import './Select.css'

export interface SelectOption {
  value: string
  label: React.ReactNode
  searchText: string
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  'aria-label': string
}

export default function Select({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Выбрать…',
  'aria-label': ariaLabel
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeaheadRef = useRef('')
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listboxId = useId()
  const reduceMotion = useReducedMotion()

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex)
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function commit(index: number): void {
    const opt = options[index]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  function typeahead(char: string): void {
    typeaheadRef.current += char.toLowerCase()
    clearTimeout(typeaheadTimer.current)
    typeaheadTimer.current = setTimeout(() => (typeaheadRef.current = ''), 600)
    const match = options.findIndex((o) =>
      o.searchText.toLowerCase().startsWith(typeaheadRef.current)
    )
    if (match >= 0) setActiveIndex(match)
  }

  function onTriggerKeyDown(e: React.KeyboardEvent): void {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      default:
        if (e.key.length === 1) typeahead(e.key)
    }
  }

  return (
    <div className="select" ref={rootRef}>
      <button
        type="button"
        role="combobox"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="select-value">{selected ? selected.label : placeholder}</span>
        <svg
          className="select-chevron"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 5.5L7 9.5L11 5.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className="select-listbox scroll-fade"
            role="listbox"
            id={listboxId}
            ref={listRef}
            aria-label={ariaLabel}
            tabIndex={-1}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.14, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listboxId}-option-${i}`}
                role="option"
                aria-selected={opt.value === value}
                className={`select-option${i === activeIndex ? ' is-active' : ''}${
                  opt.value === value ? ' is-selected' : ''
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(i)
                }}
              >
                <span className="select-option-label">{opt.label}</span>
                {opt.value === value && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 7.2L5.5 10.2L11.5 3.8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
