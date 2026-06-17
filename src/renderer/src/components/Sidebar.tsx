import { useMemo, useState } from 'react'
import { useStore } from '../store'
import Logo from './Logo'
import {
  ChartIcon,
  ChevronDown,
  ChevronRight,
  ClockIcon,
  InboxIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  TagIcon,
  TodayIcon,
  UpcomingIcon
} from './Icons'
import type { Project, ViewQuery } from '@shared/types'

function NavItem({
  icon,
  label,
  count,
  active,
  color,
  onClick
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="nav-icon" style={color ? { color } : undefined}>
        {icon}
      </span>
      <span className="nav-label">{label}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </button>
  )
}

export default function Sidebar() {
  const view = useStore((s) => s.view)
  const screen = useStore((s) => s.screen)
  const projects = useStore((s) => s.projects)
  const labels = useStore((s) => s.labels)
  const counts = useStore((s) => s.counts)
  const theme = useStore((s) => s.theme)
  const selectView = useStore((s) => s.selectView)
  const openScreen = useStore((s) => s.openScreen)
  const setTheme = useStore((s) => s.setTheme)
  const setQuickAddOpen = useStore((s) => s.setQuickAddOpen)
  const createProject = useStore((s) => s.createProject)

  const [projectsOpen, setProjectsOpen] = useState(true)
  const [labelsOpen, setLabelsOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [newProject, setNewProject] = useState('')

  const isActive = (kind: ViewQuery['kind'], id?: number): boolean =>
    screen === 'tasks' &&
    view.kind === kind &&
    (id === undefined || view.projectId === id || view.labelId === id)

  const tree = useMemo(() => {
    const roots = projects.filter((p) => !p.isInbox && p.parentId == null)
    const childrenOf = (id: number): Project[] => projects.filter((p) => p.parentId === id)
    return { roots, childrenOf }
  }, [projects])

  const PRESET = '#e8584c #eb8909 #f9c000 #7ecc49 #299438 #6accbc #158fad #14aaf5 #96c3eb #4073ff #884dff #af38eb #eb96eb #e05194 #ff8d85 #808080'.split(
    ' '
  )

  const submitProject = (): void => {
    const name = newProject.trim()
    if (name) {
      void createProject(name, PRESET[name.length % PRESET.length])
      setNewProject('')
      setAddingProject(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <Logo size={24} />
          <span>Arbeiten</span>
        </div>
        <button
          className="icon-btn"
          title="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>
      </div>

      <button className="add-task-btn" onClick={() => setQuickAddOpen(true)}>
        <span className="add-task-plus">
          <PlusIcon size={14} strokeWidth={3} />
        </span>
        Add task
      </button>

      <div className="search-box">
        <SearchIcon size={16} />
        <input
          value={search}
          placeholder="Search"
          onChange={(e) => {
            setSearch(e.target.value)
            if (e.target.value.trim()) selectView({ kind: 'search', text: e.target.value }, 'Search')
            else selectView({ kind: 'today' }, 'Today')
          }}
        />
      </div>

      <nav className="nav">
        <NavItem
          icon={<InboxIcon size={19} />}
          label="Inbox"
          color="#246fe0"
          count={counts.inbox}
          active={isActive('inbox')}
          onClick={() => selectView({ kind: 'inbox' }, 'Inbox')}
        />
        <NavItem
          icon={<TodayIcon size={19} />}
          label="Today"
          color="#058527"
          count={counts.today}
          active={isActive('today')}
          onClick={() => selectView({ kind: 'today' }, 'Today')}
        />
        <NavItem
          icon={<UpcomingIcon size={19} />}
          label="Upcoming"
          color="#692fc2"
          count={counts.upcoming}
          active={isActive('upcoming')}
          onClick={() => selectView({ kind: 'upcoming' }, 'Upcoming')}
        />
        <NavItem
          icon={<TagIcon size={19} />}
          label="Filters & Labels"
          color="#eb8909"
          active={screen === 'filters'}
          onClick={() => openScreen('filters')}
        />
        <NavItem
          icon={<ChartIcon size={19} />}
          label="Productivity"
          color="#dc4c3e"
          active={screen === 'productivity'}
          onClick={() => openScreen('productivity')}
        />
      </nav>

      <div className="nav-section">
        <button className="section-head" onClick={() => setProjectsOpen((o) => !o)}>
          {projectsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span>My Projects</span>
          <span
            className="icon-btn section-add"
            onClick={(e) => {
              e.stopPropagation()
              setAddingProject(true)
              setProjectsOpen(true)
            }}
            role="button"
            title="Add project"
          >
            <PlusIcon size={15} />
          </span>
        </button>
        {projectsOpen && (
          <div className="project-list">
            {addingProject && (
              <div className="project-composer">
                <input
                  autoFocus
                  placeholder="Project name"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitProject()
                    if (e.key === 'Escape') {
                      setAddingProject(false)
                      setNewProject('')
                    }
                  }}
                  onBlur={() => {
                    if (newProject.trim()) submitProject()
                    else setAddingProject(false)
                  }}
                />
              </div>
            )}
            {tree.roots.length === 0 && !addingProject && (
              <div className="empty-hint">No projects yet</div>
            )}
            {tree.roots.map((p) => (
              <ProjectRow key={p.id} project={p} depth={0} childrenOf={tree.childrenOf} />
            ))}
          </div>
        )}
      </div>

      {labels.length > 0 && (
        <div className="nav-section">
          <button className="section-head" onClick={() => setLabelsOpen((o) => !o)}>
            {labelsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Labels</span>
          </button>
          {labelsOpen && (
            <div className="project-list">
              {labels.map((l) => (
                <button
                  key={l.id}
                  className={`nav-item project-item${isActive('label', l.id) ? ' active' : ''}`}
                  onClick={() => selectView({ kind: 'label', labelId: l.id }, l.name)}
                >
                  <span className="nav-icon" style={{ color: l.color }}>
                    <TagIcon size={16} />
                  </span>
                  <span className="nav-label">{l.name}</span>
                  {counts.byLabel[l.id] ? (
                    <span className="nav-count">{counts.byLabel[l.id]}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sidebar-foot">
        <button className="focus-launch" onClick={() => useStore.getState().setFocusOpen(true)}>
          <ClockIcon size={17} />
          Focus
        </button>
      </div>
    </aside>
  )
}

function ProjectRow({
  project,
  depth,
  childrenOf
}: {
  project: Project
  depth: number
  childrenOf: (id: number) => Project[]
}) {
  const view = useStore((s) => s.view)
  const screen = useStore((s) => s.screen)
  const counts = useStore((s) => s.counts)
  const selectView = useStore((s) => s.selectView)
  const kids = childrenOf(project.id)
  const active = screen === 'tasks' && view.kind === 'project' && view.projectId === project.id

  return (
    <>
      <button
        className={`nav-item project-item${active ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => selectView({ kind: 'project', projectId: project.id }, project.name)}
      >
        <span className="project-dot" style={{ background: project.color }} />
        <span className="nav-label">{project.name}</span>
        {counts.byProject[project.id] ? (
          <span className="nav-count">{counts.byProject[project.id]}</span>
        ) : null}
      </button>
      {kids.map((c) => (
        <ProjectRow key={c.id} project={c} depth={depth + 1} childrenOf={childrenOf} />
      ))}
    </>
  )
}
