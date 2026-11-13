import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  CalendarCheck,
  Cpu,
  LayoutDashboard,
  Megaphone,
  Plus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  deleteAnnouncement,
  logActivity,
  normalizeEmail,
  saveAnnouncement,
  saveGradeRecord,
} from '../services/instituteService';
import {
  AnnouncementRecord,
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
  GradeRecord,
  InviteRecord,
  TeacherRecord,
} from '../types/institute';
import { AnnouncementModal, GradeModal } from './admin/AdminModals';
import { LeadsAIHub } from './leads-ai/LeadsAIHub';
import { TeacherAttendanceWorkspace } from './teacher/TeacherAttendanceWorkspace';
import { AppShell, NavItem } from './ui/AppShell';
import { CourseThumbnail } from './ui/CourseThumbnail';
import { StatusText } from './ui/StatusText';

interface TeacherPortalProps {
  user: User;
  invite: InviteRecord;
  onSignOut: () => void;
}

type TeacherTab = 'overview' | 'courses' | 'attendance' | 'grades' | 'announcements' | 'leads-ai';

export function TeacherPortal({ user, invite, onSignOut }: TeacherPortalProps) {
  const email = normalizeEmail(user.email || '');
  const [activeTab, setActiveTab] = useState<TeacherTab>('overview');
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [profile, setProfile] = useState<TeacherRecord | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [roleAnnouncements, setRoleAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [authoredAnnouncements, setAuthoredAnnouncements] = useState<AnnouncementRecord[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        collection(db, 'courses'),
        (snap) => setCourses(snap.docs.map((d) => d.data() as CourseRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
      ),
      onSnapshot(
        query(collection(db, 'teachers'), where('email', '==', email)),
        (snap) => setProfile(snap.docs[0]?.data() as TeacherRecord | null),
        (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
      ),
      onSnapshot(
        query(collection(db, 'enrollments'), where('teacherEmail', '==', email)),
        (snap) => setEnrollments(snap.docs.map((d) => d.data() as EnrollmentRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
      ),
      onSnapshot(
        query(collection(db, 'attendance'), where('teacherEmail', '==', email)),
        (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      ),
      onSnapshot(
        query(collection(db, 'grades'), where('teacherEmail', '==', email)),
        (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
      ),
      onSnapshot(
        query(collection(db, 'announcements'), where('targetRole', 'in', ['all', 'teacher'])),
        (snap) => setRoleAnnouncements(snap.docs.map((d) => d.data() as AnnouncementRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      ),
      onSnapshot(
        query(collection(db, 'announcements'), where('authorEmail', '==', email)),
        (snap) => setAuthoredAnnouncements(snap.docs.map((d) => d.data() as AnnouncementRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [email]);

  const myCourses = useMemo(() => {
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
    return courses.filter(
      (c) =>
        c.teacherEmail === email ||
        profile?.assignedCourseIds?.includes(c.id) ||
        enrolledCourseIds.has(c.id)
    );
  }, [courses, email, profile, enrollments]);

  useEffect(() => {
    if (!selectedCourseId && myCourses.length > 0) {
      setSelectedCourseId(myCourses[0].id);
    }
  }, [myCourses, selectedCourseId]);

  const announcements = useMemo(() => {
    const map = new Map<string, AnnouncementRecord>();
    [...roleAnnouncements, ...authoredAnnouncements].forEach((a) => map.set(a.id, a));
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );
  }, [roleAnnouncements, authoredAnnouncements]);

  const notify = (msg: string) => {
    setBanner(msg);
    window.setTimeout(() => setBanner(null), 4000);
  };

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'courses',
      label: 'Assigned Courses',
      icon: <BookOpen className="h-4 w-4" />,
      badge: myCourses.length,
    },
    {
      id: 'attendance',
      label: 'Mark Attendance',
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      id: 'grades',
      label: 'Gradebook',
      icon: <Award className="h-4 w-4" />,
      badge: grades.length || undefined,
    },
    {
      id: 'announcements',
      label: 'Announcements',
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
      role="teacher"
      userName={profile?.fullName || invite.displayName || user.displayName || 'Faculty'}
      userEmail={email}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as TeacherTab)}
      onSignOut={onSignOut}
      headerAction={
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          <span>Mark Attendance</span>
        </button>
      }
    >
      {banner && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
          {banner}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Welcome, {profile?.fullName || invite.displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your assigned Leads Nexus Institute diploma tracks, student attendance, and
              assessments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Assigned Courses</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {myCourses.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Active diploma classes</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Enrolled Students</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {enrollments.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Across your assigned batches</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Graded Assessments</div>
              <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
                {grades.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Published to student &amp; parent portals</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Assigned Student Roster</h2>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {enrollments.length} enrollments
                </span>
              </div>
              {myCourses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Open Daily Attendance
                </button>
              )}
            </div>
            {enrollments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No students assigned to your courses yet. Contact the administrator if courses need
                to be assigned.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Roll No</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Batch</th>
                      <th className="px-5 py-3 text-right">Attendance</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((enr) => {
                      const stuAtt = attendance.filter(
                        (a) => a.courseId === enr.courseId && a.studentId === enr.studentId
                      );
                      const stuPresent = stuAtt.filter(
                        (a) => a.status === 'present' || a.status === 'late'
                      ).length;
                      const stuPct =
                        stuAtt.length === 0 ? null : Math.round((stuPresent / stuAtt.length) * 100);

                      return (
                        <tr key={enr.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">
                            {enr.studentRollNumber}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            {enr.studentName}
                          </td>
                          <td className="px-5 py-3 text-slate-700">{enr.courseTitle}</td>
                          <td className="px-5 py-3 text-xs text-slate-500">{enr.batch}</td>
                          <td className="px-5 py-3 text-right font-mono tabular-nums text-xs">
                            {stuPct !== null ? (
                              <span
                                className={`font-semibold ${
                                  stuPct >= 75 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {stuPct}% ({stuPresent}/{stuAtt.length})
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <StatusText status={enr.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                Open Announcements
              </button>
            </div>
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No notices posted for faculty yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {announcements.slice(0, 3).map((ann) => (
                  <div key={ann.id} className="px-6 py-4">
                    <div className="text-xs text-slate-500">
                      <span className="capitalize font-medium text-blue-700">
                        Audience: {ann.targetRole}
                      </span>{' '}
                      · {ann.courseTitle} · By {ann.authorName}
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Assigned Courses</h1>
            <p className="mt-1 text-sm text-slate-600">
              Syllabus modules and class schedules for your assigned diploma programs.
            </p>
          </div>
          {myCourses.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No courses have been assigned to your faculty profile yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myCourses.map((course) => {
                const count = enrollments.filter((e) => e.courseId === course.id).length;
                return (
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
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span>
                          {course.code} · {course.durationMonths} Months
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>{count} students</span>
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-slate-950">{course.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Syllabus Modules
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600">
                          {course.modules.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <TeacherAttendanceWorkspace
          teacherEmail={email}
          teacherName={profile?.fullName || invite.displayName || email}
          courses={myCourses}
          enrollments={enrollments}
          attendance={attendance}
          selectedCourseId={selectedCourseId}
          onSelectCourseId={setSelectedCourseId}
          onNotify={notify}
        />
      )}

      {activeTab === 'grades' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Course Gradebook
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Publish exam and practical assessment results for your students.
              </p>
            </div>
            <button
              type="button"
              disabled={enrollments.length === 0}
              onClick={() => {
                setEditingGrade(null);
                setGradeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Grade</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {grades.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No grades recorded yet for your courses.
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
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grades.map((g) => (
                      <tr key={g.id}>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">{g.studentName}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {g.studentRollNumber}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-700">{g.courseTitle}</td>
                        <td className="px-5 py-3">{g.assessmentTitle}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          {g.score} / {g.maxScore}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-blue-700">
                          {g.gradeLetter}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">
                          {g.gradedDate}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGrade(g);
                              setGradeModalOpen(true);
                            }}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Announcements</h1>
              <p className="mt-1 text-sm text-slate-600">
                View institute updates and publish course notices to students and parents.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Post Course Notice</span>
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No announcements yet.
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <article
                  key={ann.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                      <span className="capitalize font-medium text-blue-700">
                        Audience: {ann.targetRole}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{ann.courseTitle}</span>
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
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{ann.body}</p>
                  </div>
                  {ann.authorEmail === email && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnnouncement(ann);
                          setAnnouncementModalOpen(true);
                        }}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteAnnouncement(ann.id);
                          logActivity({
                            category: 'announcement',
                            action: 'Deleted Course Notice',
                            details: `Deleted announcement "${ann.title}" (${ann.courseTitle}).`,
                            actorName: profile?.fullName || invite.displayName || email,
                            actorEmail: email,
                            actorRole: 'teacher',
                            targetLabel: ann.title,
                          }).catch(() => {});
                          notify('Deleted notice.');
                        }}
                        className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'leads-ai' && (
        <LeadsAIHub
          userRole="teacher"
          userName={profile?.fullName || invite.displayName || user.displayName || 'Faculty'}
        />
      )}

      <GradeModal
        open={gradeModalOpen}
        initial={editingGrade}
        enrollments={enrollments}
        gradedBy={email}
        onClose={() => setGradeModalOpen(false)}
        onSave={async (payload, isEdit) => {
          await saveGradeRecord(payload, isEdit);
          logActivity({
            category: 'grade',
            action: isEdit ? 'Updated Assessment Grade' : 'Recorded Assessment Grade',
            details: `${payload.assessmentTitle}: ${payload.score}/${payload.maxScore} for ${payload.enrollment.studentName} (${payload.enrollment.courseTitle}).`,
            actorName: profile?.fullName || invite.displayName || email,
            actorEmail: email,
            actorRole: 'teacher',
            targetLabel: payload.enrollment.studentName,
          }).catch(() => {});
          notify('Saved assessment grade.');
        }}
      />

      <AnnouncementModal
        open={announcementModalOpen}
        initial={editingAnnouncement}
        courses={myCourses.length > 0 ? myCourses : courses}
        authorName={profile?.fullName || invite.displayName || 'Faculty'}
        authorEmail={email}
        authorRole="teacher"
        onClose={() => setAnnouncementModalOpen(false)}
        onSave={async (data, isEdit) => {
          await saveAnnouncement(data, isEdit);
          logActivity({
            category: 'announcement',
            action: isEdit ? 'Updated Course Notice' : 'Published Course Notice',
            details: `${data.title} (${data.courseTitle} · Audience: ${data.targetRole}).`,
            actorName: profile?.fullName || invite.displayName || email,
            actorEmail: email,
            actorRole: 'teacher',
            targetLabel: data.title,
          }).catch(() => {});
          notify('Published notice.');
        }}
      />
    </AppShell>
  );
}
