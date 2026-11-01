import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportReport } from '../../api/projects'

interface ExportPanelProps {
  projectId: string
  alternativeId: string
  projectName: string
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  projectId,
  alternativeId,
  projectName,
}) => {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (format: 'pdf' | 'html' | 'json' | 'dxf') => {
    try {
      setDownloading(format)
      setError(null)
      const blob = await exportReport(projectId, alternativeId, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'dxf' ? 'dxf' : format
      a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${format === 'dxf' ? 'fefco0201_dieline' : 'report'}.${ext}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(`Failed to download ${format.toUpperCase()}: ${err?.message || err}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 shadow-sm space-y-6">
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {t('export.title', 'Engineering Documentation & Production Exports')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('export.subtitle', 'Export verified engineering reports including formulas, packaging calculations, assumptions, and FEFCO 0201 cutting dielines.')}
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-md text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PDF Export */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">PDF Engineering Report</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Printable engineering document with 3D views, formulas, McKee analysis, and ISO table.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            {downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {/* HTML Export */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">HTML Standalone Report</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Self-contained interactive web report shareable with colleagues and suppliers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('html')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors border border-slate-300 dark:border-slate-700"
          >
            {downloading === 'html' ? 'Generating HTML...' : 'Download HTML'}
          </button>
        </div>

        {/* FEFCO 0201 DXF Dieline */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M12 4v16" strokeDasharray="2 2" />
              </svg>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                CAD READY
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">FEFCO 0201 DXF Dieline</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Standard carton flat pattern with separated CUT and CREASE layers for sample cutters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('dxf')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            {downloading === 'dxf' ? 'Generating DXF...' : 'Download DXF Dieline'}
          </button>
        </div>

        {/* JSON Export */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">JSON Project Specs</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Complete structured data record with parameters, calculations, and data provenance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('json')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors border border-slate-300 dark:border-slate-700"
          >
            {downloading === 'json' ? 'Generating JSON...' : 'Download JSON'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default ExportPanel
