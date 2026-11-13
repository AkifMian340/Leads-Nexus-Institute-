import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Award,
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
  ParentRecord,
  StudentRecord,
} from '../types/institute';
import { LeadsAIHub } from './leads-ai/LeadsAIHub';
import { AppShell, NavItem } from './ui/AppShell';
import { StatusText } from './ui/StatusText';

interface ParentPortalProps {
  user: User;
  invite: InviteRecord;
  onSignOut: () => void;
}

type ParentTab = 'overview' | 'attendance' | 'grades' | 'fees' | 'announcements' | 'leads-ai';

export function ParentPortal({ user, invite, onSignOut }: ParentPortalProps) {
  const email = normalizeEmail(user.email || '');
  const [activeTab, setActiveTab] = useState<ParentTab>('overview');
  const [parentProfile, setParentProfile] = useState<ParentRecord | null>(null);
  const [children, setChildren] = useState<StudentRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [courses, setCourses] = useState<CourseRecord[]>([]);
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
        query(collection(db, 'parents'), where('email', '==', email)),
        (snap) => setParentProfile(snap.docs[0]?.data() as ParentRecord | null),
        (err) => handleFirestoreError(err, OperationType.LIST, 'parents')
      ),
      onSnapshot(
        query(collection(db, 'students'), where('parentEmail', '==', email)),
        (snap) => setChildren(snap.docs.map((d) => d.data() as StudentRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      ),
      onSnapshot(
        query(collection(db, 'enrollments'), where('parentEmail', '==', email)),
        (snap) => setEnrollments(snap.docs.map((d) => d.data() as EnrollmentRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
      ),
      onSnapshot(
        query(collection(db, 'attendance'), where('parentEmail', '==', email)),
        (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      ),
      onSnapshot(
        query(collection(db, 'grades'), where('parentEmail', '==', email)),
        (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
      ),
      onSnapshot(
        query(collection(db, 'fees'), where('parentEmail', '==', email)),
        (snap) => setFees(snap.docs.map((d) => d.data() as FeeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'fees')
      ),
      onSnapshot(
        query(collection(db, 'announcements'), where('targetRole', 'in', ['all', 'parent'])),
        (snap) => setAnnouncements(snap.docs.map((d) => d.data() as AnnouncementRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [email]);

  const scopedEnrollments = useMemo(
    () =>
      selectedChildId === 'all'
        ? enrollments
        : enrollments.filter((e) => e.studentId === selectedChildId),
    [enrollments, selectedChildId]
  );

  const scopedAttendance = useMemo(
    () =>
      selectedChildId === 'all'
        ? attendance
        : attendance.filter((a) => a.studentId === selectedChildId),
    [attendance, selectedChildId]
  );

  const scopedGrades = useMemo(
    () =>
      selectedChildId === 'all'
        ? grades
        : grades.filter((g) => g.studentId === selectedChildId),
    [grades, selectedChildId]
  );

  const scopedFees = useMemo(
    () =>
      selectedChildId === 'all' ? fees : fees.filter((f) => f.studentId === selectedChildId),
    [fees, selectedChildId]
  );

  const attendancePct = useMemo(() => {
    if (scopedAttendance.length === 0) return 100;
    const presentCount = scopedAttendance.filter(
      (a) => a.status === 'present' || a.status === 'late'
    ).length;
    return Math.round((presentCount / scopedAttendance.length) * 100);
  }, [scopedAttendance]);

  const avgScorePct = useMemo(() => {
    if (scopedGrades.length === 0) return null;
    const total = scopedGrades.reduce((acc, g) => acc + (g.score / Math.max(1, g.maxScore)) * 100, 0);
    return Math.round(total / scopedGrades.length);
  }, [scopedGrades]);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Student Progress', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'attendance',
      label: 'Attendance Log',
      icon: <CalendarCheck className="h-4 w-4" />,
      badge: `${attendancePct}%`,
    },
    {
      id: 'grades',
      label: 'Exam Grades',
      icon: <Award className="h-4 w-4" />,
      badge: scopedGrades.length || undefined,
    },
    {
      id: 'fees',
      label: 'Fee Payments',
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: 'announcements',
      label: 'Institute Notices',
      icon: <Megaphone className="h-4 w-4" />,
      badge: announcements.length || undefined,
    },
    {
      id: 'leads-ai',
      label: 'Leads AI',
      icon: <Cpu className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      role="parent"
      userName={parentProfile?.fullName || invite.displayName || user.displayName || 'Parent'}
      userEmail={email}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as ParentTab)}
      onSignOut={onSignOut}
      headerAction={
        children.length > 1 ? (
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-700 focus:outline-none"
          >
            <option value="all">All Linked Students ({children.length})</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.fullName} ({child.rollNumber})
              </option>
            ))}
          </select>
        ) : undefined
      }
    >
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Parent &amp; Guardian Portal
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Monitor your child&apos;s Leads Nexus Institute computer diploma attendance, scores,
              and tuition ledger.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Linked Students</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {children.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {scopedEnrollments.length} active course enrollments
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Attendance Rate</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {attendancePct}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {scopedAttendance.length} recorded sessions
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Average Score</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {avgScorePct !== null ? `${avgScorePct}%` : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {scopedGrades.length} graded assessments
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Pending Fee Vouchers</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {scopedFees.filter((f) => f.status !== 'paid').length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {scopedFees.filter((f) => f.status === 'paid').length} paid vouchers
              </div>
            </div>
          </div>

          {/* Linked Children & Course Details */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-950">
                Linked Student Profiles &amp; Courses
              </h2>
            </div>
            {children.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No students are linked to your parent email yet. Please ask the institute
                administrator to link your child&apos;s profile.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {children.map((child) => {
                  const childCourses = courses.filter((c) => child.courseIds.includes(c.id));
                  return (
                    <div
                      key={child.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                          <span>{child.rollNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>{child.batch}</span>
                        </div>
                        <div className="text-base font-bold text-slate-950 mt-0.5">
                          {child.fullName}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Courses:{' '}
                          {childCourses.map((c) => c.title).join(' · ') || 'No course assigned'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-xs text-slate-400">Fee Status</div>
                          <StatusText status={child.feeStatus} />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">Enrollment</div>
                          <StatusText status={child.status} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Student Attendance Log
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Recorded class attendance across enrolled diploma courses.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {scopedAttendance.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No attendance records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedAttendance.map((rec) => (
                      <tr key={rec.id}>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{rec.date}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {rec.studentName}
                        </td>
                        <td className="px-5 py-3 text-slate-700">{rec.courseTitle}</td>
                        <td className="px-5 py-3">
                          <StatusText status={rec.status} />
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
      )}

      {activeTab === 'grades' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Academic Progress &amp; Grades
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Assessment scores and teacher feedback for your linked student(s).
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {scopedGrades.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No assessment grades published yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Assessment</th>
                      <th className="px-5 py-3 text-right">Score</th>
                      <th className="px-5 py-3">Grade</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedGrades.map((g) => (
                      <tr key={g.id}>
                        <td className="px-5 py-3 font-semibold text-slate-900">{g.studentName}</td>
                        <td className="px-5 py-3 text-xs text-slate-700">{g.courseTitle}</td>
                        <td className="px-5 py-3">{g.assessmentTitle}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {g.score} / {g.maxScore}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-blue-700">
                          {g.gradeLetter}
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Fee &amp; Payment History
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tuition fee vouchers, due dates, and paid receipts.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {scopedFees.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No fee records issued yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Receipt</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Month / Course</th>
                      <th className="px-5 py-3 text-right">Total Fee</th>
                      <th className="px-5 py-3 text-right">Paid</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scopedFees.map((f) => (
                      <tr key={f.id}>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">{f.receiptNo}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">{f.studentName}</td>
                        <td className="px-5 py-3 text-xs">
                          <div className="font-medium text-slate-900">{f.monthLabel}</div>
                          <div className="text-slate-500">{f.courseTitle}</div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          PKR {f.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          PKR {f.paidAmount.toLocaleString()}
                        </td>
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Institute Notices</h1>
          {announcements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No announcements posted.
            </div>
          ) : (
            announcements.map((ann) => (
              <article key={ann.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs text-slate-500">
                  {ann.courseTitle} · By {ann.authorName}
                </div>
                <h2 className="mt-1 text-base font-bold text-slate-950">{ann.title}</h2>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{ann.body}</p>
              </article>
            ))
          )}
        </div>
      )}

      {activeTab === 'leads-ai' && (
        <LeadsAIHub
          userRole="parent"
          userName={parentProfile?.fullName || invite.displayName || user.displayName || 'Parent'}
        />
      )}
    </AppShell>
  );
}
