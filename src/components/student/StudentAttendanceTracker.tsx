import { CalendarCheck, CheckCircle2, Clock, Filter, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AttendanceRecord, CourseRecord } from '../../types/institute';
import { StatusText } from '../ui/StatusText';

interface StudentAttendanceTrackerProps {
  attendance: AttendanceRecord[];
  courses: CourseRecord[];
  initialCourseId?: string;
}

type StatusFilter = 'all' | 'present' | 'late' | 'absent';

export function StudentAttendanceTracker({
  attendance,
  courses,
  initialCourseId = 'all',
}: StudentAttendanceTrackerProps) {
  const [courseFilter, setCourseFilter] = useState<string>(initialCourseId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  useEffect(() => {
    setCourseFilter(initialCourseId || 'all');
  }, [initialCourseId]);

  const sortedAttendance = useMemo(() => {
    return [...attendance].sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);

  const overallStats = useMemo(() => {
    const total = sortedAttendance.length;
    const present = sortedAttendance.filter((a) => a.status === 'present').length;
    const late = sortedAttendance.filter((a) => a.status === 'late').length;
    const absent = sortedAttendance.filter((a) => a.status === 'absent').length;
    const rate = total === 0 ? 100 : Math.round(((present + late) / total) * 100);
    return { total, present, late, absent, rate };
  }, [sortedAttendance]);

  const courseBreakdown = useMemo(() => {
    const knownCourses = new Map<string, { id: string; code: string; title: string; teacherName: string; schedule: string }>();
    courses.forEach((c) => {
      knownCourses.set(c.id, {
        id: c.id,
        code: c.code,
        title: c.title,
        teacherName: c.teacherName || 'Assigned Faculty',
        schedule: c.schedule || 'Scheduled Class',
      });
    });

    sortedAttendance.forEach((rec) => {
      if (!knownCourses.has(rec.courseId)) {
        knownCourses.set(rec.courseId, {
          id: rec.courseId,
          code: 'COURSE',
          title: rec.courseTitle,
          teacherName: rec.teacherEmail || 'Faculty',
          schedule: 'Recorded Sessions',
        });
      }
    });

    return Array.from(knownCourses.values()).map((course) => {
      const records = sortedAttendance.filter((a) => a.courseId === course.id);
      const total = records.length;
      const present = records.filter((a) => a.status === 'present').length;
      const late = records.filter((a) => a.status === 'late').length;
      const absent = records.filter((a) => a.status === 'absent').length;
      const rate = total === 0 ? null : Math.round(((present + late) / total) * 100);
      const lastDate = records[0]?.date || null;

      return {
        ...course,
        total,
        present,
        late,
        absent,
        rate,
        lastDate,
      };
    });
  }, [courses, sortedAttendance]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    sortedAttendance.forEach((rec) => {
      if (rec.date && rec.date.length >= 7) {
        months.add(rec.date.slice(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [sortedAttendance]);

  const filteredRecords = useMemo(() => {
    return sortedAttendance.filter((rec) => {
      if (courseFilter !== 'all' && rec.courseId !== courseFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (monthFilter !== 'all' && !rec.date.startsWith(monthFilter)) return false;
      return true;
    });
  }, [sortedAttendance, courseFilter, statusFilter, monthFilter]);

  const hasActiveFilters =
    courseFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all';

  const resetFilters = () => {
    setCourseFilter('all');
    setStatusFilter('all');
    setMonthFilter('all');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Attendance Tracking</h1>
          <p className="mt-1 text-sm text-slate-600">
            Course-wise attendance percentage, daily class roll records, and instructor remarks.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-medium">
          Minimum diploma target: <span className="font-mono tabular-nums font-bold text-slate-900">75%</span>
        </div>
      </div>

      {/* Overall Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Overall Attendance</span>
            <CalendarCheck className="h-4 w-4 text-blue-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
            {overallStats.rate}%
          </div>
          <div className="mt-1.5 text-xs">
            {overallStats.total === 0 ? (
              <span className="text-slate-500">No sessions recorded yet</span>
            ) : overallStats.rate >= 75 ? (
              <span className="font-semibold text-emerald-700">
                Good standing · {overallStats.total} sessions
              </span>
            ) : (
              <span className="font-semibold text-rose-700">
                Below 75% target · {overallStats.total} sessions
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Present</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-emerald-700">
            {overallStats.present}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            On-time class sessions attended
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Late Arrivals</span>
            <Clock className="h-4 w-4 text-amber-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-amber-700">
            {overallStats.late}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Counted as attended with late note
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Absent</span>
            <XCircle className="h-4 w-4 text-rose-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-rose-700">
            {overallStats.absent}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Missed diploma class sessions
          </div>
        </div>
      </div>

      {/* Per-Course Breakdown */}
      {courseBreakdown.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">Attendance by Enrolled Course</h2>
            {courseFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCourseFilter('all')}
                className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                Show all courses
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseBreakdown.map((course) => {
              const isSelected = courseFilter === course.id;
              const barColor =
                course.rate === null
                  ? 'bg-slate-200'
                  : course.rate >= 75
                  ? 'bg-emerald-600'
                  : course.rate >= 50
                  ? 'bg-amber-600'
                  : 'bg-rose-600';

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setCourseFilter(isSelected ? 'all' : course.id)}
                  className={`text-left rounded-xl border p-5 transition-colors ${
                    isSelected
                      ? 'border-blue-700 bg-blue-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                    <span className="truncate">{course.code}</span>
                    <span className="tabular-nums shrink-0">
                      {course.lastDate ? `Last: ${course.lastDate}` : 'No sessions'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-950 truncate">{course.title}</h3>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-950 shrink-0">
                      {course.rate !== null ? `${course.rate}%` : '—'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 truncate">
                    Instructor: {course.teacherName}
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${barColor}`}
                      style={{ width: `${course.rate ?? 0}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
                    <span className="text-emerald-700 font-semibold">{course.present} Present</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700 font-semibold">{course.late} Late</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-rose-700 font-semibold">{course.absent} Absent</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Daily Session Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter Roll</span>
            </div>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="Filter by course"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Enrolled Courses</option>
              {courseBreakdown.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filter by month"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start lg:self-auto">
            {(['all', 'present', 'late', 'absent'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {sortedAttendance.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-800">No attendance entries recorded yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Daily attendance marked by your course instructors will appear here in real time.
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-800">No sessions match your filters</p>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing the course, month, or status filter to see all recorded classes.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Course</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Recorded By</th>
                  <th className="px-5 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{rec.courseTitle}</td>
                    <td className="px-5 py-3">
                      <StatusText status={rec.status} />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {rec.markedBy || rec.teacherEmail || 'Faculty'}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{rec.remarks || '—'}</td>
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
