import React from 'react'

interface DataBadgeProps {
  label: string
}

export const DataBadge: React.FC<DataBadgeProps> = ({ label }) => {
  const upper = (label || '').toUpperCase()
  let bgClass = 'bg-slate-700 text-slate-200 border-slate-600'

  if (upper.includes('SAMPLE')) {
    bgClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  } else if (upper.includes('PUBLIC RETAIL')) {
    bgClass = 'bg-orange-500/20 text-orange-300 border-orange-500/40'
  } else if (upper.includes('USER ENTERED')) {
    bgClass = 'bg-blue-500/20 text-blue-300 border-blue-500/40'
  } else if (upper.includes('ESTIMATE')) {
    bgClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  } else if (upper.includes('VERIFIED')) {
    bgClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wider border ${bgClass}`}
      title={label}
    >
      {label}
    </span>
  )
}
