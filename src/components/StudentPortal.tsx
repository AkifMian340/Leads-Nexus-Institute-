import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  CalendarCheck,
  Cpu,
  CreditCard,
  LayoutDashboard,
  Megaphone,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { normalizeEmail } from '../services/instituteService';
import {
  AnnouncementRecord,
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
  FeeRecord,
  GradeRecord,
  InviteRecord,
  StudentRecord,
} from '../types/institute';
import { AppShell, NavItem } from './ui/AppShell';
import { CourseThumbnail } from './ui/CourseThumbnail';
import { StatusText } from './ui/StatusText';
import { LeadsAIHub } from './leads-ai/LeadsAIHub';
import { StudentAttendanceTracker } from './student/StudentAttendanceTracker';

interface StudentPortalProps {
  user: User;
  invite: InviteRecord;
  onSignOut: () => void;
}

type StudentTab =
  | 'overview'
  | 'courses'
  | 'attendance'
  | 'grades'
  | 'fees'
  | 'announcements'
  | 'leads-ai';

export function StudentPortal({ user, invite, onSignOut }: StudentPortalProps) {
  const email = normalizeEmail(user.email || '');
  const [activeTab, setActiveTab] = useState<StudentTab>('overview');
  const [selectedAttendanceCourseId, setSelectedAttendanceCourseId] = useState<string>('all');
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [profile, setProfile] = useState<StudentRecord | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        collection(db, 'courses'),
        (snap) => setCourses(snap.docs.map((d) => d.data() as CourseRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
      ),
      onSnapshot(
        query(collection(db, 'students'), where('email', '==', email)),
        (snap) => setProfile(snap.docs[0]?.data() as StudentRecord | null),
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      ),
      onSnapshot(
        query(collection(db, 'enrollments'), where('studentEmail', '==', email)),
        (snap) => setEnrollments(snap.docs.map((d) => d.data() as EnrollmentRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
      ),
      onSnapshot(
        query(collection(db, 'attendance'), where('studentEmail', '==', email)),
        (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      ),
      onSnapshot(
        query(collection(db, 'grades'), where('studentEmail', '==', email)),
        (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
      ),
      onSnapshot(
        query(collection(db, 'fees'), where('studentEmail', '==', email)),
        (snap) => setFees(snap.docs.map((d) => d.data() as FeeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'fees')
      ),
      onSnapshot(
        query(collection(db, 'announcements'), where('targetRole', 'in', ['all', 'student'])),
        (snap) => setAnnouncements(snap.docs.map((d) => d.data() as AnnouncementRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [email]);

  const myCourses = useMemo(() => {
    const ids = new Set([
      ...(profile?.courseIds || []),
      ...enrollments.map((e) => e.courseId),
    ]);
    return courses.filter((c) => ids.has(c.id));
  }, [courses, profile, enrollments]);

  const attendancePct = useMemo(() => {
    if (attendance.length === 0) return 100;
    const presentCount = attendance.filter(
      (a) => a.status === 'present' || a.status === 'late'
    ).length;
    return Math.round((presentCount / attendance.length) * 100);
  }, [attendance]);

  const avgGradePct = useMemo(() => {
    if (grades.length === 0) return null;
    const total = grades.reduce((acc, g) => acc + (g.score / Math.max(1, g.maxScore)) * 100, 0);
    return Math.round(total / grades.length);
  }, [grades]);

  const visibleAnnouncements = useMemo(() => {
    const myCourseIds = new Set(myCourses.map((c) => c.id));
    return [...announcements]
      .filter((ann) => ann.courseId === 'all' || myCourseIds.size === 0 || myCourseIds.has(ann.courseId))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  }, [announcements, myCourses]);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'courses',
      label: 'My Courses',
      icon: <BookOpen className="h-4 w-4" />,
      badge: myCourses.length,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <CalendarCheck className="h-4 w-4" />,
      badge: `${attendancePct}%`,
    },
    {
      id: 'grades',
      label: 'Grades & Results',
      icon: <Award className="h-4 w-4" />,
      badge: grades.length || undefined,
    },
    {
      id: 'fees',
      label: 'Fee Ledger',
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: 'announcements',
      label: 'Notices',
      icon: <Megaphone className="h-4 w-4" />,
      badge: visibleAnnouncements.length || undefined,
    },
    {
      id: 'leads-ai',
      label: 'Leads AI',
      icon: <Cpu className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      role="student"
      userName={profile?.fullName || invite.displayName || user.displayName || 'Student'}
      userEmail={email}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as StudentTab)}
      onSignOut={onSignOut}
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Welcome, {profile?.fullName || invite.displayName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Roll No: <span className="font-mono text-slate-900">{profile?.rollNumber || '—'}</span>{' '}
                · Batch: {profile?.batch || 'Active'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Enrolled Courses</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {myCourses.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Active diploma tracks</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Attendance Rate</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {attendancePct}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {attendance.length} recorded sessions
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Assessment Average</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {avgGradePct !== null ? `${avgGradePct}%` : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">{grades.length} graded items</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Tuition Fee Status</div>
              <div className="mt-3">
                <StatusText status={profile?.feeStatus || 'pending'} />
              </div>
              <div className="mt-2 text-xs font-mono tabular-nums text-slate-500">
                PKR {(profile?.monthlyFee || 0).toLocaleString()} / month
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-slate-950">My Enrolled Diploma Tracks</h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedAttendanceCourseId('all');
                  setActiveTab('attendance');
                }}
                className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                Full Attendance Tracker
              </button>
            </div>
            {myCourses.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No courses linked to your account yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {myCourses.map((course) => {
                  const courseAtt = attendance.filter((a) => a.courseId === course.id);
                  const coursePresent = courseAtt.filter(
                    (a) => a.status === 'present' || a.status === 'late'
                  ).length;
                  const courseAttPct =
                    courseAtt.length === 0
                      ? null
                      : Math.round((coursePresent / courseAtt.length) * 100);

                  return (
                    <div
                      key={course.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4"
                    >
                      <div>
                        <div className="text-xs font-mono text-slate-500">
                          {course.code} · {course.durationMonths} Months
                        </div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">
                          {course.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Instructor: {course.teacherName || 'TBA'} · {course.schedule}
                          {courseAttPct !== null && (
                            <>
                              {' '}
                              · Attendance:{' '}
                              <span
                                className={`font-mono tabular-nums font-semibold ${
                                  courseAttPct >= 75 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {courseAttPct}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAttendanceCourseId(course.id);
                            setActiveTab('attendance');
                          }}
                          className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Attendance
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('courses')}
                          className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          View Syllabus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-slate-950">Latest Institute Notices</h2>
              <button
                type="button"
                onClick={() => setActiveTab('announcements')}
                className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
              >
                View All Notices
              </button>
            </div>
            {visibleAnnouncements.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No notices posted for students yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleAnnouncements.slice(0, 3).map((ann) => (
                  <div key={ann.id} className="px-6 py-4">
                    <div className="text-xs text-slate-500">
                      {ann.courseTitle} · By {ann.authorName}
                      {ann.createdAt && (
                        <>
                          {' '}
                          ·{' '}
                          <span className="font-mono tabular-nums">
                            {ann.createdAt.toDate().toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{ann.title}</div>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{ann.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">My Courses</h1>
            <p className="mt-1 text-sm text-slate-600">
              Your active computer diploma syllabus modules and class timings.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCourses.map((course) => (
              <article
                key={course.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                  <CourseThumbnail
                    imageKey={course.imageKey}
                    title={course.title}
                    className="h-full w-full"
                  />
                </div>
                <div className="p-5 flex-1">
                  <div className="text-xs font-mono text-slate-500">
                    {course.code} · {course.durationMonths} Months
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-950">{course.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                  <div className="mt-3 text-xs text-slate-500">
                    Instructor: <span className="font-semibold text-slate-900">{course.teacherName}</span> ·{' '}
                    {course.schedule}
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Curriculum Modules
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {course.modules.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <StudentAttendanceTracker
          attendance={attendance}
          courses={myCourses}
          initialCourseId={selectedAttendanceCourseId}
        />
      )}

      {activeTab === 'grades' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Grades &amp; Results</h1>
            <p className="mt-1 text-sm text-slate-600">
              Evaluations, practical scores, and instructor feedback.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {grades.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No assessment grades published yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Assessment</th>
                      <th className="px-5 py-3 text-right">Score</th>
                      <th className="px-5 py-3">Grade</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grades.map((g) => (
                      <tr key={g.id}>
                        <td className="px-5 py-3 font-medium text-slate-900">{g.courseTitle}</td>
                        <td className="px-5 py-3 text-slate-700">{g.assessmentTitle}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {g.score} / {g.maxScore}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-blue-700">
                          {g.gradeLetter}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">
                          {g.gradedDate}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">{g.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Fee Ledger</h1>
            <p className="mt-1 text-sm text-slate-600">
              Monthly diploma fee vouchers and payment receipts.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {fees.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No fee vouchers issued yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Receipt</th>
                      <th className="px-5 py-3">Month / Course</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-right">Paid</th>
                      <th className="px-5 py-3">Due Date</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fees.map((f) => (
                      <tr key={f.id}>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{f.receiptNo}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{f.monthLabel}</div>
                          <div className="text-xs text-slate-500">{f.courseTitle}</div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          PKR {f.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          PKR {f.paidAmount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{f.dueDate}</td>
                        <td className="px-5 py-3">
                          <StatusText status={f.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Institute Notices</h1>
            <p className="mt-1 text-sm text-slate-600">
              Official announcements from institute administration and your course instructors.
            </p>
          </div>
          {visibleAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No announcements posted.
            </div>
          ) : (
            visibleAnnouncements.map((ann) => (
              <article key={ann.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-blue-700">{ann.courseTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    By {ann.authorName} ({ann.authorRole})
                  </span>
                  {ann.createdAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {ann.createdAt.toDate().toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="mt-1.5 text-base font-bold text-slate-950">{ann.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                  {ann.body}
                </p>
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'leads-ai' && (
        <LeadsAIHub
          userRole="student"
          userName={profile?.fullName || invite.displayName || user.displayName || 'Student'}
        />
      )}
    </AppShell>
  );
}
