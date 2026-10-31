import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProjects, deleteProject } from '../api/projects'

export const ProjectsList: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this packaging project?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            📁 Saved Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access, view 3D previews, or export reports for previous packaging optimizations.
          </p>
        </div>

        <Link
          to="/projects/new"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>New Project</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          Loading saved projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-slate-900/60 p-12 rounded-xl border border-slate-800 text-center space-y-3">
          <span className="text-3xl block">📦</span>
          <h3 className="text-sm font-semibold text-slate-200">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't saved any packaging optimizations yet. Click the button below to create one.
          </p>
          <Link
            to="/projects/new"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
          >
            Create Your First Project
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900/60 rounded-xl border border-slate-800 divide-y divide-slate-800 shadow-md">
          {projects.map((p) => (
            <div
              key={p.project_id}
              onClick={() => navigate(`/projects/${p.project_id}`)}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-850/50 cursor-pointer transition-colors"
            >
              <div>
                <h3 className="font-bold text-slate-100 text-sm hover:text-blue-400 transition-colors">
                  {p.name}
                </h3>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                  <span>Product: {p.product_name || 'N/A'}</span>
                  <span className="text-slate-600">•</span>
                  <span>Updated: {new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  Open in 3D →
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, p.project_id)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs border border-slate-700 transition-all"
                  title="Delete project"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
