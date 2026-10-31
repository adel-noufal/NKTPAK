import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProjects, listExamples, loadExample, deleteProject } from '../api/projects'
import type { ExampleProject } from '../types'

// ── Source badge ──────────────────────────────────────────────

const SourceBadge: React.FC<{ sourceType?: string }> = ({ sourceType }) => {
  const labels: Record<string, { label: string; className: string }> = {
    EL_ARABY_DATASHEET: { label: 'El Araby Datasheet', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    EL_ARABY_WEBSITE: { label: 'El Araby Website', className: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' },
    DERIVED: { label: 'Derived', className: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
    USER_ENTERED: { label: 'User Entered', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  }
  const def = labels[sourceType ?? ''] ?? { label: sourceType ?? 'Unknown', className: 'bg-slate-100 dark:bg-slate-800 text-slate-500' }
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${def.className}`}>
      {def.label}
    </span>
  )
}

// ── Example Card ──────────────────────────────────────────────

const ExampleCard: React.FC<{
  example: ExampleProject
  onLoad: () => void
  loading: boolean
}> = ({ example, onLoad, loading }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
          {example.example_name}
        </h3>
        {example.model && (
          <p className="text-xs text-slate-500 font-mono mt-0.5">{example.model}</p>
        )}
      </div>
      <SourceBadge sourceType={example.source_type} />
    </div>

    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
      {example.description}
    </p>

    {example.available_fields && example.available_fields.length > 0 && (
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          Available
        </p>
        <div className="flex flex-wrap gap-1">
          {example.available_fields.slice(0, 6).map((f) => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              {f}
            </span>
          ))}
        </div>
      </div>
    )}

    {example.missing_fields && example.missing_fields.length > 0 && (
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
          Not available — must be measured
        </p>
        <div className="flex flex-wrap gap-1">
          {example.missing_fields.slice(0, 4).map((f) => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {f}
            </span>
          ))}
          {example.missing_fields.length > 4 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
              +{example.missing_fields.length - 4} more
            </span>
          )}
        </div>
      </div>
    )}

    <button
      type="button"
      onClick={onLoad}
      disabled={loading}
      className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Loading…' : 'Load as Draft Project'}
    </button>
  </div>
)

// ── Project Row ───────────────────────────────────────────────

const ProjectRow: React.FC<{
  project: any
  onDelete: () => void
  deleting: boolean
}> = ({ project, onDelete, deleting }) => {
  const navigate = useNavigate()
  const statusColors: Record<string, string> = {
    draft: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    completed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    failed: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  }
  const statusClass = statusColors[project.status] ?? 'text-slate-500 bg-slate-100 dark:bg-slate-800'

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="py-3 px-4">
        <button
          type="button"
          onClick={() => navigate(`/projects/${project.project_id}`)}
          className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
        >
          {project.name}
        </button>
        {project.product_name && (
          <p className="text-xs text-slate-400 mt-0.5">
            {project.product_name}
            {project.product_model && <span className="font-mono ml-1">({project.product_model})</span>}
          </p>
        )}
      </td>
      <td className="py-3 px-4">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>
          {project.status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {project.has_results ? (
          <span className="text-emerald-600 dark:text-emerald-400">Results ready</span>
        ) : (
          <span className="text-slate-400">No results yet</span>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-slate-400">
        {new Date(project.updated_at).toLocaleDateString()}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${project.project_id}`)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  const { data: examples = [], isLoading: loadingExamples } = useQuery({
    queryKey: ['examples'],
    queryFn: listExamples,
  })

  const [loadingExampleId, setLoadingExampleId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleLoadExample = async (exampleId: string) => {
    try {
      setLoadingExampleId(exampleId)
      const res = await loadExample(exampleId)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/projects/${res.project_id}`)
    } catch (err: any) {
      alert(`Could not load example: ${err.message}`)
    } finally {
      setLoadingExampleId(null)
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      setDeletingId(projectId)
      await deleteProject(projectId)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          NxtPak AI
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Parametric packaging optimization for El Araby Group.
          Recommends right-sized cartons, shows 3D interior/exterior fit, and evaluates against ISO packaging standards.
        </p>
      </div>

      {/* Start options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            title: 'Load a real product',
            desc: 'Start from TSF-16W or BL500/2 with verified El Araby data.',
            action: () => {},  // handled below by example cards
            disabled: true,
          },
          {
            title: 'Enter manually',
            desc: 'Enter product dimensions, weight, and baseline carton yourself.',
            action: () => navigate('/projects/new?start=manual'),
            disabled: false,
          },
          {
            title: 'Fetch from El Araby',
            desc: 'Enter a model number or URL to auto-fetch known product data.',
            action: () => navigate('/projects/new?start=fetch'),
            disabled: false,
          },
          {
            title: 'Upload 3D / CAD',
            desc: 'Upload STL, OBJ, GLB, STEP, or DXF to extract dimensions.',
            action: () => navigate('/projects/new?start=upload'),
            disabled: false,
          },
        ].map((opt) => (
          <button
            key={opt.title}
            type="button"
            onClick={opt.action}
            disabled={opt.disabled}
            className={`text-left p-4 rounded-lg border transition-all ${
              opt.disabled
                ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-60 cursor-default'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm'
            }`}
          >
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{opt.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* Reference examples */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Reference Products
            <span className="ml-2 text-xs font-normal text-slate-400">Real El Araby data only</span>
          </h2>
        </div>

        {loadingExamples ? (
          <p className="text-sm text-slate-400">Loading examples…</p>
        ) : examples.length === 0 ? (
          <p className="text-sm text-slate-400">No reference products available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examples.map((ex) => (
              <ExampleCard
                key={ex.example_id}
                example={ex}
                onLoad={() => handleLoadExample(ex.example_id)}
                loading={loadingExampleId === ex.example_id}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2">
          Reference products use real data from El Araby datasheets and product pages.
          Fields marked "Not available" are genuinely unknown — they must be measured on site before optimization can run.
          No values are invented.
        </p>
      </div>

      {/* Projects table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Your Projects
          </h2>
          <Link
            to="/projects/new"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            New project
          </Link>
        </div>

        {loadingProjects ? (
          <p className="text-sm text-slate-400">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
            <p className="text-sm text-slate-500 dark:text-slate-400">No projects yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Start from a real product above or{' '}
              <Link to="/projects/new" className="text-blue-600 dark:text-blue-400 hover:underline">
                enter values manually
              </Link>.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Project</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Results</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900">
                {projects.map((p) => (
                  <ProjectRow
                    key={p.project_id}
                    project={p}
                    onDelete={() => handleDelete(p.project_id)}
                    deleting={deletingId === p.project_id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
