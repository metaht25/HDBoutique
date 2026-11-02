import { useId, useState } from 'react'
import type { Choice } from './contracts'

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function SearchSelect({ label, value, options, onChange, disabled = false, required = false }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void; disabled?: boolean; required?: boolean }) {
  const id = useId(), [open, setOpen] = useState(false), [search, setSearch] = useState<string | null>(null), [active, setActive] = useState(0)
  const selected = options.find(row => String(row.id) === value)
  const filtered = options.filter(row => normalized(row.label).includes(normalized(search ?? '')))
  function choose(row: Choice) { onChange(String(row.id)); setSearch(null); setOpen(false) }
  return <div><label htmlFor={id}>{label}</label><input id={id} role="combobox" aria-expanded={open} aria-controls={id + '-list'} aria-autocomplete="list" aria-activedescendant={open && filtered[active] ? id + '-' + filtered[active].id : undefined} autoComplete="off" required={required} disabled={disabled} value={search ?? selected?.label ?? ''} onFocus={() => { setOpen(true); setActive(0) }} onBlur={() => { setOpen(false); setSearch(null) }} onChange={e => { setSearch(e.target.value); onChange(''); setOpen(true); setActive(0) }} onKeyDown={e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))) }
    if (e.key === 'Enter' && open) { e.preventDefault(); if (filtered[active]) choose(filtered[active]) }
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setSearch(null) }
  }} />{open && <ul id={id + '-list'} role="listbox" aria-label={label} style={{ maxHeight: 180, overflowY: 'auto', margin: 0, padding: 4, border: '1px solid #ddd', background: 'white' }}>{filtered.length ? filtered.map((row, index) => <li id={id + '-' + row.id} key={row.id} role="option" aria-selected={index === active} onClick={() => choose(row)} onMouseDown={e => { e.preventDefault(); choose(row) }} style={{ padding: 8, background: index === active ? '#fce7f3' : undefined, cursor: 'pointer' }}>{row.label}</li>) : <li role="presentation">Sin coincidencias</li>}</ul>}</div>
}
