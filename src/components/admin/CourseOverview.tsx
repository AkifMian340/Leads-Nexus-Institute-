import { ArrowUpRight, Edit3, Users } from 'lucide-react';
import {
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
  StudentRecord,
} from '../../types/institute';
import { CourseThumbnail } from '../ui/CourseThumbnail';
import { StatusText } from '../ui/StatusText';

interface CourseOverviewProps {
  courses: CourseRecord[];
  enrollments: EnrollmentRecord[];
  students: StudentRecord[];
  attendance: AttendanceRecord[];
  loading: boolean;
  onManageCourses: () => void;
  onViewCourseStudents: (courseId: string) => void;
  onEditCourse: (course: CourseRecord) => void;
  onRestoreDefaults: () => void;
}

export function CourseOverview({
  courses,
  enrollments,
  students,
  attendance,
  loading,
  onManageCourses,
  onViewCourseStudents,
  onEditCourse,
  onRestoreDefaults,
}: CourseOverviewProps) {
  const activeEnrollments = enrollments.filter((e) => e.status === 'active');
  const totalActiveEnrollments = activeEnrollments.length;

  const totalMonthlyProjectedRevenue = courses.reduce((sum, course) => {
    const count = activeEnrollments.filter((e) => e.courseId === course.id).length;
    return sum + count * course.feeMonthly;
  }, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">
            Diploma Courses &amp; Enrollment Statistics
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
            {courses.length} Courses · {totalActiveEnrollments} Active Enrollments · PKR{' '}
            {totalMonthlyProjectedRevenue.toLocaleString()} Monthly Tuition Volume
          </p>
        </div>
        <button
          type="button"
          onClick={onManageCourses}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap self-start sm:self-auto"
        >
          <span>Manage All Courses</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/9] bg-slate-100" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-28 rounded bg-slate-100" />
                <div className="h-5 w-44 rounded bg-slate-100" />
                <div className="h-12 w-full rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No diploma courses configured yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Initialize the 5 standard Leads Nexus Institute diploma tracks to begin enrolling
            students.
          </p>
          <button
            type="button"
            onClick={onRestoreDefaults}
            className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Initialize 5 Diploma Courses
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map((course) => {
            const courseEnrollments = activeEnrollments.filter((e) => e.courseId === course.id);
            const enrolledCount = courseEnrollments.length;
            const sharePct =
              totalActiveEnrollments > 0
                ? Math.round((enrolledCount / totalActiveEnrollments) * 100)
                : 0;

            const courseStudents = students.filter((s) => s.courseIds.includes(course.id));
            const paidCount = courseStudents.filter((s) => s.feeStatus === 'paid').length;

            const courseAttendance = attendance.filter((a) => a.courseId === course.id);
            const attendanceRate =
              courseAttendance.length > 0
                ? Math.round(
                    (courseAttendance.filter(
                      (a) => a.status === 'present' || a.status === 'late'
                    ).length /
                      courseAttendance.length) *
                      100
                  )
                : null;

            const monthlyVolume = enrolledCount * course.feeMonthly;

            return (
              <article
                key={course.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                  <CourseThumbnail
                    imageKey={course.imageKey}
                    title={course.title}
                    className="h-full w-full"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-slate-500 tabular-nums">
                      {course.code} · {course.durationMonths} mo
                    </div>
                    <StatusText status={course.status} />
                  </div>

                  <h3 className="mt-2 text-base font-bold text-slate-950">{course.title}</h3>

                  <div className="mt-1 text-xs text-slate-600 truncate">
                    Instructor:{' '}
                    <span className="font-medium text-slate-900">
                      {course.teacherName || 'Unassigned'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 truncate">{course.schedule}</div>

                  {/* Enrollment Share Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">Enrollment Share</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        {enrolledCount} enrolled ({sharePct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-700 transition-all duration-300"
                        style={{ width: `${Math.min(100, sharePct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Tabular Stats Strip */}
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Attendance</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                        {attendanceRate !== null ? `${attendanceRate}%` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Fee Paid</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                        {paidCount}/{courseStudents.length}
                      </dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-slate-500">Tuition/mo</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
                        PKR {monthlyVolume.toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  {/* Card Footer Actions */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onViewCourseStudents(course.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>View Students</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCourse(course)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
