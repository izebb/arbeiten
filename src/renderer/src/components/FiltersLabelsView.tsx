import { useState } from 'react'
import { useStore } from '../store'
import { TagIcon, TrashIcon, PlusIcon, FlagIcon } from './Icons'

const COLORS =
  '#e8584c #eb8909 #f9c000 #7ecc49 #299438 #6accbc #158fad #14aaf5 #4073ff #884dff #af38eb #e05194 #808080'.split(
    ' '
  )

const PRIORITY_FILTERS = [
  { p: 1, color: 'var(--p1)', label: 'Priority 1' },
  { p: 2, color: 'var(--p2)', label: 'Priority 2' },
  { p: 3, color: 'var(--p3)', label: 'Priority 3' },
  { p: 4, color: 'var(--p4)', label: 'Priority 4' }
] as const

export default function FiltersLabelsView() {
  const labels = useStore((s) => s.labels)
  const counts = useStore((s) => s.counts)
  const createLabel = useStore((s) => s.createLabel)
  const updateLabel = useStore((s) => s.updateLabel)
  const deleteLabel = useStore((s) => s.deleteLabel)
  const selectView = useStore((s) => s.selectView)

  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [adding, setAdding] = useState(false)

  const add = async (): Promise<void> => {
    if (!name.trim()) return
    await createLabel(name.trim(), color)
    setName('')
    setAdding(false)
  }

  return (
    <div className="filters-view">
      <section className="panel-section">
        <h2 className="section-title">
          <FlagIcon size={18} /> Filters
        </h2>
        <div className="filter-grid">
          {PRIORITY_FILTERS.map((f) => (
            <button
              key={f.p}
              className="filter-card"
              onClick={() => selectView({ kind: 'priority', priority: f.p }, f.label)}
            >
              <FlagIcon size={18} style={{ color: f.color }} />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title-row">
          <h2 className="section-title">
            <TagIcon size={18} /> Labels
          </h2>
          <button className="btn-ghost" onClick={() => setAdding((a) => !a)}>
            <PlusIcon size={15} /> Add label
          </button>
        </div>

        {adding && (
          <div className="label-editor">
            <input
              autoFocus
              className="composer-input"
              placeholder="Label name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add()
                if (e.key === 'Escape') setAdding(false)
              }}
            />
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch${c === color ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div className="composer-actions">
              <button className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={!name.trim()} onClick={() => void add()}>
                Add label
              </button>
            </div>
          </div>
        )}

        <div className="label-rows">
          {labels.length === 0 && <div className="empty-hint">No labels yet.</div>}
          {labels.map((l) => (
            <div key={l.id} className="label-row">
              <button
                className="label-row-main"
                onClick={() => selectView({ kind: 'label', labelId: l.id }, l.name)}
              >
                <TagIcon size={16} style={{ color: l.color }} />
                <span>{l.name}</span>
                {counts.byLabel[l.id] ? <span className="nav-count">{counts.byLabel[l.id]}</span> : null}
              </button>
              <div className="label-row-actions">
                <div className="swatches inline">
                  {COLORS.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      className={`swatch sm${c === l.color ? ' active' : ''}`}
                      style={{ background: c }}
                      onClick={() => void updateLabel(l.id, { color: c })}
                    />
                  ))}
                </div>
                <button
                  className="icon-btn"
                  title="Delete label"
                  onClick={() => {
                    if (window.confirm(`Delete label “${l.name}”?`)) void deleteLabel(l.id)
                  }}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
