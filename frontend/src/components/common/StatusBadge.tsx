import React from 'react'
import { CheckStatus, CheckType } from '../../types'

interface StatusBadgeProps {
  status: CheckStatus | string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case CheckStatus.PASS:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 me-1.5 animate-pulse" />
          PASS
        </span>
      )
    case CheckStatus.FAIL:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 me-1.5" />
          FAIL
        </span>
      )
    case CheckStatus.NEEDS_REVIEW:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 me-1.5" />
          NEEDS REVIEW
        </span>
      )
    case CheckStatus.NOT_VERIFIABLE:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 me-1.5" />
          PHYSICAL TEST REQUIRED
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          NOT CONFIGURED
        </span>
      )
  }
}

export const CheckTypeBadge: React.FC<{ type: CheckType | string }> = ({ type }) => {
  switch (type) {
    case CheckType.PROGRAMMATIC:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
          PROGRAMMATIC
        </span>
      )
    case CheckType.PHYSICAL_TEST:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          PHYSICAL TEST
        </span>
      )
    case CheckType.HUMAN_REVIEW:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          HUMAN REVIEW
        </span>
      )
    default:
      return <span className="text-xs text-slate-400">{type}</span>
  }
}
