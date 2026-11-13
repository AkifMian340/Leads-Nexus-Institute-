import { Timestamp } from 'firebase/firestore';
import { ArrowUpRight, Clock, History, LogIn, Search, Shield, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityCategory, ActivityLogRecord, UserRole } from '../../types/institute';

interface ActivityLogSectionProps {
  logs: ActivityLogRecord[];
  loading: boolean;
  onDeleteLog?: (logId: string) => Promise<void>;
  compact?: boolean;
  onViewAll?: () => void;
}

type CategoryGroup = 'all' | 'login' | 'courses_staff' | 'students_parents' | 'academics_fees';

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  login: 'Portal Login',
  course: 'Course',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  attendance: 'Attendance',
  grade: 'Gradebook',
  fee: 'Fee Ledger',
  announcement: 'Notice',
  access: 'Access Control',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
};

function formatLogTimestamp(ts?: Timestamp): string {
  if (!ts) return 'Just now';
  try {
    const d = ts.toDate();
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

export function ActivityLogSection({
  logs,
  loading,
  onDeleteLog,
  compact = false,
  onViewAll,
}: ActivityLogSectionProps) {
  const [group, setGroup] = useState<CategoryGroup>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [search, setSearch] = useState('');

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (roleFilter !== 'all' && entry.actorRole !== roleFilter) return false;
      if (group === 'login' && entry.category !== 'login') return false;
      if (
        group === 'courses_staff' &&
        !['course', 'teacher', 'access', 'announcement'].includes(entry.category)
      ) {
        return false;
      }
      if (group === 'students_parents' && !['student', 'parent'].includes(entry.category)) {
        return false;
      }
      if (group === 'academics_fees' && !['attendance', 'grade', 'fee'].includes(entry.category)) {
        return false;
      }
      if (!q) return true;
      return (
        entry.actorName.toLowerCase().includes(q) ||
        entry.actorEmail.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.targetLabel.toLowerCase().includes(q)
      );
    });
  }, [logs, group, roleFilter, search]);

  const loginCount = useMemo(() => logs.filter((l) => l.category === 'login').length, [logs]);
  const staffActionCount = useMemo(() => logs.filter((l) => l.category !== 'login').length, [logs]);

  if (compact) {
    const recent = logs.slice(0, 6);
    return (
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Recent Activity Log</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {loginCount} Logins · {staffActionCount} Administrative &amp; Staff Actions
            </p>
          </div>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              <span>View Full Log</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No logins or staff activity recorded yet. Actions performed across the institute will
            appear here in real time.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-3.5 hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900">{entry.action}</span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium text-blue-700">
                      {ROLE_LABELS[entry.actorRole]}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600 truncate">{entry.actorName}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{entry.details}</p>
                </div>
                <div className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                  {formatLogTimestamp(entry.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Activity Log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Chronological audit trail of portal sign-ins and actions performed by administrators and
            faculty staff.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600">
          <span>{loginCount} Logins</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>{staffActionCount} Staff Actions</span>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'All Events' },
                  { id: 'login', label: 'Logins' },
                  { id: 'courses_staff', label: 'Courses & Staff' },
                  { id: 'students_parents', label: 'Students & Parents' },
                  { id: 'academics_fees', label: 'Academics & Fees' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGroup(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    group === tab.id
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin Only</option>
              <option value="teacher">Teacher Staff</option>
              <option value="student">Students</option>
              <option value="parent">Parents</option>
            </select>
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by staff name, email, action, or details..."
              className="w-full text-sm focus:outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <History className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">No activity records found</p>
            <p className="mt-1 text-xs text-slate-500">
              Portal logins and administrative actions will be logged here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Action &amp; Details</th>
                  {onDeleteLog && <th className="px-5 py-3 text-right">Manage</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{formatLogTimestamp(entry.createdAt)}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{entry.actorName}</span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-semibold text-blue-700">
                          {ROLE_LABELS[entry.actorRole]}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-500">{entry.actorEmail}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {entry.category === 'login' ? (
                          <LogIn className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                        )}
                        <span>{CATEGORY_LABELS[entry.category]}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{entry.action}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{entry.details}</div>
                    </td>
                    {onDeleteLog && (
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onDeleteLog(entry.id)}
                          aria-label="Delete log entry"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
