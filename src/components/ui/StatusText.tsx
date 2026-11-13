import { AlertCircle, CheckCircle2, Clock, MinusCircle } from 'lucide-react';

interface StatusTextProps {
  status: string;
}

export function StatusText({ status }: StatusTextProps) {
  const normalized = status.toLowerCase();

  if (['active', 'paid', 'present', 'completed', 'graduated'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 capitalize whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (['pending', 'partial', 'late'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 capitalize whitespace-nowrap">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (['suspended', 'absent', 'inactive', 'dropped', 'archived'].includes(normalized)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 capitalize whitespace-nowrap">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 capitalize whitespace-nowrap">
      <MinusCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
