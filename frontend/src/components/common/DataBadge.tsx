import React from 'react'

interface DataBadgeProps {
  label: string
}

export const DataBadge: React.FC<DataBadgeProps> = ({ label }) => {
  const upper = (label || '').toUpperCase()
  let bgClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'

  if (upper.includes('DATASHEET') || upper.includes('EL_ARABY_DATASHEET')) {
    bgClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  } else if (upper.includes('WEBSITE') || upper.includes('EL_ARABY_WEBSITE')) {
    bgClass = 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
  } else if (upper.includes('DERIVED')) {
    bgClass = 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800'
  } else if (upper.includes('SAMPLE')) {
    bgClass = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  } else if (upper.includes('PUBLIC RETAIL')) {
    bgClass = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
  } else if (upper.includes('USER ENTERED') || upper.includes('USER_ENTERED')) {
    bgClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
  } else if (upper.includes('ESTIMATE')) {
    bgClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
  } else if (upper.includes('VERIFIED')) {
    bgClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border ${bgClass}`}
      title={label}
    >
      {label}
    </span>
  )
}
