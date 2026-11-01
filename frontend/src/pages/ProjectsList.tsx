import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listProjects, deleteProject, getBrands } from '../api/projects'

export const ProjectsList: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  })

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', search, selectedBrand],
    queryFn: () => listProjects({ search: search || undefined, brand: selectedBrand || undefined }),
  })

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(t('projects.confirmDelete', 'Are you sure you want to delete this packaging project? This cannot be undone.'))) return
    try {
      setDeletingId(id)
      await deleteProject(id)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || err}`)
    } finally {
      setDeletingId(null)
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    completed: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    failed: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
  }

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('projects.title', 'Saved Packaging Projects')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('projects.subtitle', 'Access 3D interior/exterior previews, McKee strength analysis, and export dielines for all saved designs.')}
          </p>
        </div>

        <Link
          to="/projects/new"
          className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>{t('actions.newProject', 'New Project')}</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('dashboard.searchPlaceholder', 'Search name, brand, model, SKU...')}
            className="w-full text-xs px-3 py-1.5 ps-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="w-3.5 h-3.5 absolute start-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('dashboard.allBrands', 'All Brands')}</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Project Table or Empty State */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-xs text-slate-500">{t('dashboard.loadingProjects', 'Loading projects...')}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900/40">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t('dashboard.emptyTitle', 'No packaging projects yet')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {t('dashboard.emptySubtitle', 'Start a new packaging optimization project by entering specifications or fetching real product data from the web.')}
          </p>
          <Link
            to="/projects/new"
            className="inline-block px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors"
          >
            {t('actions.newProject', 'Create New Project')}
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-sm">
          <table className="w-full text-start">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-start px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colProject', 'Project & Model')}
                </th>
                <th className="text-start px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colBrand', 'Brand')}
                </th>
                <th className="text-start px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colStatus', 'Status')}
                </th>
                <th className="text-start px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colShortId', 'Project ID')}
                </th>
                <th className="text-start px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colCreated', 'Created')}
                </th>
                <th className="text-end px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('dashboard.colActions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {projects.map((p) => {
                const statusClass = statusColors[p.status] || 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200'
                return (
                  <tr
                    key={p.project_id}
                    onClick={() => navigate(`/projects/${p.project_id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {p.model_number || p.product_model || '—'}
                        {p.sku ? ` · SKU: ${p.sku}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {p.brand || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${statusClass}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {p.project_id.slice(0, 8)}…
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-end">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/projects/${p.project_id}`)
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {t('actions.open', 'Open')}
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, p.project_id)}
                          disabled={deletingId === p.project_id}
                          className="text-xs text-rose-600 hover:text-rose-700 dark:hover:text-rose-400 font-medium disabled:opacity-40"
                        >
                          {deletingId === p.project_id ? t('actions.deleting', 'Deleting...') : t('actions.delete', 'Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default ProjectsList
