import {
  CalendarCheck,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  History,
  Search,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  logActivity,
  markAttendanceRecord,
  markBatchAttendanceRecords,
} from '../../services/instituteService';
import {
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
} from '../../types/institute';
import { StatusText } from '../ui/StatusText';

interface TeacherAttendanceWorkspaceProps {
  teacherEmail: string;
  teacherName: string;
  courses: CourseRecord[];
  enrollments: EnrollmentRecord[];
  attendance: AttendanceRecord[];
  selectedCourseId: string;
  onSelectCourseId: (courseId: string) => void;
  onNotify: (msg: string) => void;
}

type AttendanceViewMode = 'daily' | 'summary' | 'history';

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return new Date().toISOString().slice(0, 10);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function TeacherAttendanceWorkspace({
  teacherEmail,
  teacherName,
  courses,
  enrollments,
  attendance,
  selectedCourseId,
  onSelectCourseId,
  onNotify,
}: TeacherAttendanceWorkspaceProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [viewMode, setViewMode] = useState<AttendanceViewMode>('daily');
  const [attendanceDate, setAttendanceDate] = useState<string>(todayIso);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId]
  );

  const effectiveCourseId = selectedCourse?.id || selectedCourseId;

  const courseEnrollments = useMemo(() => {
    const active = enrollments.filter(
      (e) => e.courseId === effectiveCourseId && e.status === 'active'
    );
    return active.sort((a, b) => a.studentRollNumber.localeCompare(b.studentRollNumber));
  }, [enrollments, effectiveCourseId]);

  const filteredCourseEnrollments = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return courseEnrollments;
    return courseEnrollments.filter(
      (e) =>
        e.studentName.toLowerCase().includes(q) ||
        e.studentRollNumber.toLowerCase().includes(q) ||
        e.batch.toLowerCase().includes(q)
    );
  }, [courseEnrollments, studentSearch]);

  const attendanceForDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance
      .filter((a) => a.courseId === effectiveCourseId && a.date === attendanceDate)
      .forEach((a) => map.set(a.studentId, a));
    return map;
  }, [attendance, effectiveCourseId, attendanceDate]);

  const dailySummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let unmarked = 0;
    courseEnrollments.forEach((enr) => {
      const rec = attendanceForDate.get(enr.studentId);
      if (!rec) unmarked += 1;
      else if (rec.status === 'present') present += 1;
      else if (rec.status === 'late') late += 1;
      else absent += 1;
    });
    return {
      enrolled: courseEnrollments.length,
      present,
      late,
      absent,
      unmarked,
    };
  }, [courseEnrollments, attendanceForDate]);

  const studentRatesByStudentId = useMemo(() => {
    const map = new Map<string, { present: number; late: number; absent: number; total: number; rate: number | null }>();
    courseEnrollments.forEach((enr) => {
      const records = attendance.filter(
        (a) => a.courseId === effectiveCourseId && a.studentId === enr.studentId
      );
      const total = records.length;
      const present = records.filter((a) => a.status === 'present').length;
      const late = records.filter((a) => a.status === 'late').length;
      const absent = records.filter((a) => a.status === 'absent').length;
      const rate = total === 0 ? null : Math.round(((present + late) / total) * 100);
      map.set(enr.studentId, { present, late, absent, total, rate });
    });
    return map;
  }, [courseEnrollments, attendance, effectiveCourseId]);

  const sessionHistory = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        date: string;
        courseId: string;
        courseTitle: string;
        present: number;
        late: number;
        absent: number;
        total: number;
      }
    >();

    attendance.forEach((rec) => {
      const key = `${rec.date}__${rec.courseId}`;
      const existing = grouped.get(key) || {
        key,
        date: rec.date,
        courseId: rec.courseId,
        courseTitle: rec.courseTitle,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      };
      if (rec.status === 'present') existing.present += 1;
      else if (rec.status === 'late') existing.late += 1;
      else existing.absent += 1;
      existing.total += 1;
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);

  const getRemarkKey = (studentId: string) => `${effectiveCourseId}_${attendanceDate}_${studentId}`;

  const handleMarkSingle = async (
    enr: EnrollmentRecord,
    status: 'present' | 'late' | 'absent',
    remarks: string
  ) => {
    setErrorMsg(null);
    setSavingStudentId(enr.studentId);
    try {
      await markAttendanceRecord({
        date: attendanceDate,
        enrollment: enr,
        status,
        remarks,
        markedBy: teacherEmail,
      });
      logActivity({
        category: 'attendance',
        action: 'Marked Attendance',
        details: `Marked ${enr.studentName} (${enr.studentRollNumber}) as ${status} in ${enr.courseTitle} for ${attendanceDate}.`,
        actorName: teacherName,
        actorEmail: teacherEmail,
        actorRole: 'teacher',
        targetLabel: enr.studentName,
      }).catch(() => {});
      onNotify(`Marked ${enr.studentName} as ${status} for ${attendanceDate}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save attendance entry.');
    } finally {
      setSavingStudentId(null);
    }
  };

  const handleBatchPresent = async (onlyUnmarked: boolean) => {
    const targetEnrollments = onlyUnmarked
      ? courseEnrollments.filter((enr) => !attendanceForDate.has(enr.studentId))
      : courseEnrollments;

    if (targetEnrollments.length === 0) {
      onNotify('All enrolled students already have attendance recorded for this date.');
      return;
    }

    setErrorMsg(null);
    setBatchSaving(true);
    try {
      const entries = targetEnrollments.map((enr) => {
        const existing = attendanceForDate.get(enr.studentId);
        const remarkKey = getRemarkKey(enr.studentId);
        const remarkVal = remarksMap[remarkKey] ?? existing?.remarks ?? '';
        return {
          enrollment: enr,
          status: 'present' as const,
          remarks: remarkVal,
        };
      });

      const count = await markBatchAttendanceRecords({
        date: attendanceDate,
        entries,
        markedBy: teacherEmail,
      });

      const courseTitle = selectedCourse?.title || targetEnrollments[0]?.courseTitle || 'Course';
      logActivity({
        category: 'attendance',
        action: 'Marked Batch Attendance',
        details: `Marked ${count} ${onlyUnmarked ? 'unmarked ' : ''}students present in ${courseTitle} for ${attendanceDate}.`,
        actorName: teacherName,
        actorEmail: teacherEmail,
        actorRole: 'teacher',
        targetLabel: courseTitle,
      }).catch(() => {});

      onNotify(`Marked ${count} student${count === 1 ? '' : 's'} present for ${attendanceDate}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save batch attendance.');
    } finally {
      setBatchSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Daily Attendance</h1>
          <p className="mt-1 text-sm text-slate-600">
            Record daily attendance for enrolled diploma students and sync live to the Student &amp;
            Parent portals.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'daily'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>Daily Roll Call</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'summary'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Student Summary</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'history'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Session History</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">No assigned courses yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Ask the institute administrator to assign you to one or more diploma courses to start
            recording daily attendance.
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'daily' && (
            <div className="space-y-4">
              {/* Session Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                  <div className="text-xs text-slate-500">Enrolled</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-950">
                    {dailySummary.enrolled}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                  <div className="text-xs text-slate-500">Present</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    {dailySummary.present}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                  <div className="text-xs text-slate-500">Late</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700">
                    {dailySummary.late}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                  <div className="text-xs text-slate-500">Absent</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-700">
                    {dailySummary.absent}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-500">Unmarked</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700">
                    {dailySummary.unmarked}
                  </div>
                </div>
              </div>

              {/* Roll Call Controls & Table */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 p-4 space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Assigned Course
                        </label>
                        <select
                          value={effectiveCourseId}
                          onChange={(e) => onSelectCourseId(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
                        >
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} · {c.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Class Date
                        </label>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAttendanceDate((d) => shiftIsoDate(d, -1))}
                            aria-label="Previous day"
                            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <input
                            type="date"
                            value={attendanceDate}
                            onChange={(e) => setAttendanceDate(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono tabular-nums focus:border-blue-700 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setAttendanceDate((d) => shiftIsoDate(d, 1))}
                            aria-label="Next day"
                            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          {attendanceDate !== todayIso && (
                            <button
                              type="button"
                              onClick={() => setAttendanceDate(todayIso)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              Today
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {dailySummary.unmarked > 0 && (
                        <button
                          type="button"
                          disabled={batchSaving || courseEnrollments.length === 0}
                          onClick={() => handleBatchPresent(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>
                            {batchSaving
                              ? 'Saving...'
                              : `Mark Unmarked Present (${dailySummary.unmarked})`}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={batchSaving || courseEnrollments.length === 0}
                        onClick={() => handleBatchPresent(false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark All Present</span>
                      </button>
                    </div>
                  </div>

                  {courseEnrollments.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          placeholder="Search enrolled student by name or roll no..."
                          className="w-full text-xs focus:outline-none"
                        />
                      </div>
                      {selectedCourse && (
                        <div className="text-xs text-slate-500">
                          Schedule: <span className="text-slate-700 font-medium">{selectedCourse.schedule}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {courseEnrollments.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No active enrolled students found in this course.
                  </div>
                ) : filteredCourseEnrollments.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No students match &ldquo;{studentSearch}&rdquo;.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <tr>
                          <th className="px-5 py-3">Roll No</th>
                          <th className="px-5 py-3">Student</th>
                          <th className="px-5 py-3">Course Rate</th>
                          <th className="px-5 py-3">Remarks</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Mark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCourseEnrollments.map((enr) => {
                          const existing = attendanceForDate.get(enr.studentId);
                          const remarkKey = getRemarkKey(enr.studentId);
                          const remarkVal = remarksMap[remarkKey] ?? existing?.remarks ?? '';
                          const remarkChanged =
                            existing !== undefined &&
                            remarksMap[remarkKey] !== undefined &&
                            remarksMap[remarkKey] !== existing.remarks;
                          const stats = studentRatesByStudentId.get(enr.studentId);
                          const isBusy = batchSaving || savingStudentId === enr.studentId;

                          return (
                            <tr key={enr.id} className="hover:bg-slate-50/70">
                              <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                                {enr.studentRollNumber}
                              </td>
                              <td className="px-5 py-3">
                                <div className="font-semibold text-slate-900">{enr.studentName}</div>
                                <div className="text-xs text-slate-500">{enr.batch}</div>
                              </td>
                              <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                                {stats?.rate !== null && stats?.rate !== undefined ? (
                                  <span
                                    className={
                                      stats.rate >= 75
                                        ? 'font-semibold text-emerald-700'
                                        : 'font-semibold text-rose-700'
                                    }
                                  >
                                    {stats.rate}% ({stats.present + stats.late}/{stats.total})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">New</span>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={remarkVal}
                                    onChange={(e) =>
                                      setRemarksMap((prev) => ({
                                        ...prev,
                                        [remarkKey]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !isBusy) {
                                        e.preventDefault();
                                        handleMarkSingle(
                                          enr,
                                          existing?.status || 'present',
                                          remarkVal
                                        );
                                      }
                                    }}
                                    placeholder="Optional note..."
                                    className="w-full max-w-[190px] rounded border border-slate-200 px-2.5 py-1 text-xs focus:border-blue-700 focus:outline-none"
                                  />
                                  {remarkChanged && (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleMarkSingle(enr, existing.status, remarkVal)
                                      }
                                      className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                                    >
                                      Save Note
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                {existing ? (
                                  <StatusText status={existing.status} />
                                ) : (
                                  <span className="text-xs text-slate-400">Unmarked</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                                {(['present', 'late', 'absent'] as const).map((st) => (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleMarkSingle(enr, st, remarkVal)}
                                    className={`rounded px-2.5 py-1 text-xs font-semibold capitalize border transition-colors disabled:opacity-50 ${
                                      existing?.status === st
                                        ? st === 'absent'
                                          ? 'border-rose-700 bg-rose-700 text-white'
                                          : st === 'late'
                                          ? 'border-amber-600 bg-amber-600 text-white'
                                          : 'border-blue-700 bg-blue-700 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === 'summary' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Course Attendance Summary
                  </label>
                  <select
                    value={effectiveCourseId}
                    onChange={(e) => onSelectCourseId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {courseEnrollments.length} active students
                </div>
              </div>

              {courseEnrollments.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No enrolled students in this course yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-5 py-3">Roll No</th>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3 text-right">Present</th>
                        <th className="px-5 py-3 text-right">Late</th>
                        <th className="px-5 py-3 text-right">Absent</th>
                        <th className="px-5 py-3 text-right">Sessions</th>
                        <th className="px-5 py-3 text-right">Rate</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {courseEnrollments.map((enr) => {
                        const stats = studentRatesByStudentId.get(enr.studentId) || {
                          present: 0,
                          late: 0,
                          absent: 0,
                          total: 0,
                          rate: null,
                        };
                        return (
                          <tr key={enr.id} className="hover:bg-slate-50/70">
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">
                              {enr.studentRollNumber}
                            </td>
                            <td className="px-5 py-3">
                              <div className="font-semibold text-slate-900">{enr.studentName}</div>
                              <div className="text-xs text-slate-500">{enr.batch}</div>
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                              {stats.present}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                              {stats.late}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-rose-700 font-semibold">
                              {stats.absent}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                              {stats.total}
                            </td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums font-bold">
                              {stats.rate !== null ? (
                                <span
                                  className={
                                    stats.rate >= 75 ? 'text-emerald-700' : 'text-rose-700'
                                  }
                                >
                                  {stats.rate}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setAttendanceDate(todayIso);
                                  setViewMode('daily');
                                }}
                                className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                              >
                                Mark Today
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === 'history' && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950">Recorded Attendance Sessions</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {sessionHistory.length} session{sessionHistory.length === 1 ? '' : 's'}
                </span>
              </div>

              {sessionHistory.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">No recorded sessions yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Start marking attendance in Daily Roll Call to build a searchable session log.
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode('daily')}
                    className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Open Daily Roll Call
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Course</th>
                        <th className="px-5 py-3 text-right">Present</th>
                        <th className="px-5 py-3 text-right">Late</th>
                        <th className="px-5 py-3 text-right">Absent</th>
                        <th className="px-5 py-3 text-right">Marked</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionHistory.map((session) => (
                        <tr key={session.key} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3 font-mono tabular-nums text-xs text-slate-700">
                            {session.date}
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {session.courseTitle}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {session.present}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                            {session.late}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-rose-700 font-semibold">
                            {session.absent}
                          </td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                            {session.total}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCourseId(session.courseId);
                                setAttendanceDate(session.date);
                                setViewMode('daily');
                              }}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              Open Roll
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
