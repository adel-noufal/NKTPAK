import React, { useState } from 'react'
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
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (format: 'pdf' | 'html' | 'json') => {
    try {
      setDownloading(format)
      setError(null)
      const blob = await exportReport(projectId, alternativeId, format)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_report.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      setError(`Failed to download ${format.toUpperCase()}: ${err.message}`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 shadow-xl space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          📑 Engineering Documentation & Exports
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Export verified engineering reports including formulas, packaging calculations,
          assumptions, and full ISO registry evaluation.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PDF Export */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">📄</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-200 text-sm">PDF Engineering Report</h4>
            <p className="text-xs text-slate-400 mt-1">
              Complete printable engineering specification with drawings, formulas, and ISO table.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow"
          >
            {downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {/* HTML Export */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🌐</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-200 text-sm">HTML Interactive Report</h4>
            <p className="text-xs text-slate-400 mt-1">
              Self-contained standalone web report viewable in any browser without dependencies.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('html')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs transition-all"
          >
            {downloading === 'html' ? 'Generating HTML...' : 'Download HTML'}
          </button>
        </div>

        {/* JSON Export */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{'{ }'}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                READY
              </span>
            </div>
            <h4 className="font-bold text-slate-200 text-sm">JSON Project File</h4>
            <p className="text-xs text-slate-400 mt-1">
              Complete structured dataset with dimensional specifications, calculations, and provenance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('json')}
            disabled={downloading !== null}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs transition-all"
          >
            {downloading === 'json' ? 'Generating JSON...' : 'Download JSON'}
          </button>
        </div>
      </div>
    </div>
  )
}
