import { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Award,
  BookOpen,
  CalendarCheck,
  Cpu,
  CreditCard,
  Edit3,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  deleteActivityLog,
  deleteAnnouncement,
  deleteCourse,
  deleteFeeRecord,
  deleteGradeRecord,
  deleteParentWithInvite,
  deleteStudentWithInvite,
  deleteTeacherWithInvite,
  logActivity,
  markAttendanceRecord,
  recordFeePayment,
  restoreMissingDefaultCourses,
  saveAnnouncement,
  saveCourse,
  saveFeeRecord,
  saveGradeRecord,
  saveParentWithInvite,
  saveStudentWithInvite,
  saveTeacherWithInvite,
  seedDefaultCoursesIfEmpty,
  toggleInviteStatus,
} from '../services/instituteService';
import {
  ActivityCategory,
  ActivityLogRecord,
  AnnouncementRecord,
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
  FeeRecord,
  GradeRecord,
  InviteRecord,
  ParentRecord,
  StudentRecord,
  TeacherRecord,
} from '../types/institute';
import { AppShell, NavItem } from './ui/AppShell';
import { CourseThumbnail } from './ui/CourseThumbnail';
import { StatusText } from './ui/StatusText';
import { ActivityLogSection } from './admin/ActivityLogSection';
import {
  AnnouncementModal,
  CourseModal,
  FeeModal,
  GradeModal,
  ParentModal,
  StudentModal,
  TeacherModal,
} from './admin/AdminModals';
import { AnnouncementsBoard } from './admin/AnnouncementsBoard';
import { CourseOverview } from './admin/CourseOverview';
import { FeeManagement } from './admin/FeeManagement';
import { LeadsAIHub } from './leads-ai/LeadsAIHub';

interface AdminDashboardProps {
  user: User;
  onSignOut: () => void;
}

type AdminTab =
  | 'overview'
  | 'courses'
  | 'teachers'
  | 'students'
  | 'parents'
  | 'academics'
  | 'fees'
  | 'announcements'
  | 'activity'
  | 'leads-ai';

export function AdminDashboard({ user, onSignOut }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);

  // Search & filters
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentCourseFilter, setStudentCourseFilter] = useState('all');
  const [parentSearch, setParentSearch] = useState('');

  // Academics tab state
  const [academicsMode, setAcademicsMode] = useState<'attendance' | 'grades'>('attendance');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});

  // Modals
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRecord | null>(null);

  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);

  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [editingParent, setEditingParent] = useState<ParentRecord | null>(null);

  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeRecord | null>(null);
  const [defaultFeeStudentId, setDefaultFeeStudentId] = useState<string | undefined>(undefined);

  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRecord | null>(null);

  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    seedDefaultCoursesIfEmpty().catch((err) => {
      console.error('Course seed failed:', err);
    });

    const unsubs = [
      onSnapshot(
        collection(db, 'courses'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as CourseRecord);
          list.sort((a, b) => a.code.localeCompare(b.code));
          setCourses(list);
          setSelectedCourseId((prev) => prev || list[0]?.id || '');
          setLoading(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
      ),
      onSnapshot(
        collection(db, 'teachers'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as TeacherRecord);
          list.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setTeachers(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
      ),
      onSnapshot(
        collection(db, 'students'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as StudentRecord);
          list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
          setStudents(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      ),
      onSnapshot(
        collection(db, 'parents'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ParentRecord);
          list.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setParents(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'parents')
      ),
      onSnapshot(
        collection(db, 'invites'),
        (snap) => setInvites(snap.docs.map((d) => d.data() as InviteRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'invites')
      ),
      onSnapshot(
        collection(db, 'enrollments'),
        (snap) => setEnrollments(snap.docs.map((d) => d.data() as EnrollmentRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'enrollments')
      ),
      onSnapshot(
        collection(db, 'attendance'),
        (snap) => setAttendance(snap.docs.map((d) => d.data() as AttendanceRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      ),
      onSnapshot(
        collection(db, 'grades'),
        (snap) => setGrades(snap.docs.map((d) => d.data() as GradeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'grades')
      ),
      onSnapshot(
        collection(db, 'fees'),
        (snap) => setFees(snap.docs.map((d) => d.data() as FeeRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'fees')
      ),
      onSnapshot(
        collection(db, 'announcements'),
        (snap) => setAnnouncements(snap.docs.map((d) => d.data() as AnnouncementRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'announcements')
      ),
      onSnapshot(
        query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(120)),
        (snap) => setActivityLogs(snap.docs.map((d) => d.data() as ActivityLogRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);

  const inviteByEmail = useMemo(() => {
    const map = new Map<string, InviteRecord>();
    invites.forEach((inv) => map.set(inv.email.toLowerCase(), inv));
    return map;
  }, [invites]);

  const nextRollNumber = useMemo(() => {
    const num = students.length + 1;
    return `LNI-2026-${String(num).padStart(3, '0')}`;
  }, [students.length]);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.specialization.toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      const matchesCourse =
        studentCourseFilter === 'all' || s.courseIds.includes(studentCourseFilter);
      const matchesQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.parentEmail.toLowerCase().includes(q);
      return matchesCourse && matchesQuery;
    });
  }, [students, studentSearch, studentCourseFilter]);

  const filteredParents = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q)
    );
  }, [parents, parentSearch]);

  const courseEnrollments = useMemo(
    () => enrollments.filter((e) => e.courseId === selectedCourseId && e.status === 'active'),
    [enrollments, selectedCourseId]
  );

  const attendanceMapForDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance
      .filter((a) => a.courseId === selectedCourseId && a.date === attendanceDate)
      .forEach((a) => map.set(a.studentId, a));
    return map;
  }, [attendance, selectedCourseId, attendanceDate]);

  const notify = (msg: string) => {
    setBannerMessage(msg);
    window.setTimeout(() => setBannerMessage(null), 4000);
  };

  const recordAdminAction = (
    category: ActivityCategory,
    action: string,
    details: string,
    targetLabel?: string
  ) => {
    logActivity({
      category,
      action,
      details,
      actorName: user.displayName || 'Institute Admin',
      actorEmail: user.email || '',
      actorRole: 'admin',
      targetLabel,
    }).catch((err) => console.error('Activity log write failed:', err));
  };

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      id: 'courses',
      label: 'Diploma Courses',
      icon: <BookOpen className="h-4 w-4" />,
      badge: courses.length,
    },
    {
      id: 'teachers',
      label: 'Teachers',
      icon: <UserCheck className="h-4 w-4" />,
      badge: teachers.length,
    },
    {
      id: 'students',
      label: 'Students',
      icon: <GraduationCap className="h-4 w-4" />,
      badge: students.length,
    },
    {
      id: 'parents',
      label: 'Parents',
      icon: <Users className="h-4 w-4" />,
      badge: parents.length,
    },
    {
      id: 'academics',
      label: 'Attendance & Grades',
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      id: 'fees',
      label: 'Fee Ledger',
      icon: <CreditCard className="h-4 w-4" />,
      badge: fees.filter((f) => f.status !== 'paid').length || undefined,
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: <Megaphone className="h-4 w-4" />,
      badge: announcements.length || undefined,
    },
    {
      id: 'activity',
      label: 'Activity Log',
      icon: <History className="h-4 w-4" />,
      badge: activityLogs.length || undefined,
    },
    {
      id: 'leads-ai',
      label: 'Leads AI',
      icon: <Cpu className="h-4 w-4" />,
    },
  ];

  const handleRestoreDefaults = async () => {
    const added = await restoreMissingDefaultCourses();
    if (added > 0) {
      recordAdminAction(
        'course',
        'Restored Default Courses',
        `Restored ${added} default computer diploma course(s).`,
        'Diploma Courses'
      );
      notify(`Restored ${added} default computer diploma course(s).`);
    } else {
      notify('All 5 default computer diploma courses are already active.');
    }
  };

  return (
    <AppShell
      role="admin"
      userName={user.displayName || 'Institute Admin'}
      userEmail={user.email || ''}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => setActiveTab(id as AdminTab)}
      onSignOut={onSignOut}
      headerAction={
        <button
          type="button"
          onClick={() => {
            setEditingStudent(null);
            setStudentModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Enroll Student</span>
        </button>
      }
    >
      {bannerMessage && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
          {bannerMessage}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Institute Command Overview
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage diploma courses, authorized faculty, enrolled students, and parent access.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTeacher(null);
                  setTeacherModalOpen(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                + Add Teacher
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingParent(null);
                  setParentModalOpen(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                + Add Parent
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAnnouncement(null);
                  setAnnouncementModalOpen(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                + Post Notice
              </button>
            </div>
          </div>

          {/* 4 KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Diploma Courses</div>
              <div className="mt-2 text-3xl font-bold text-slate-950 font-mono tabular-nums">
                {courses.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {courses.filter((c) => c.status === 'active').length} active tracks
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Authorized Teachers</div>
              <div className="mt-2 text-3xl font-bold text-slate-950 font-mono tabular-nums">
                {teachers.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {teachers.filter((t) => t.status === 'active').length} active portal logins
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Enrolled Students</div>
              <div className="mt-2 text-3xl font-bold text-slate-950 font-mono tabular-nums">
                {students.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {students.filter((s) => s.status === 'active').length} active diploma learners
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Linked Parents</div>
              <div className="mt-2 text-3xl font-bold text-slate-950 font-mono tabular-nums">
                {parents.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {invites.filter((i) => i.status === 'active').length} total active user invites
              </div>
            </div>
          </div>

          {/* 5 Diploma Courses & Enrollment Cards Grid */}
          <CourseOverview
            courses={courses}
            enrollments={enrollments}
            students={students}
            attendance={attendance}
            loading={loading}
            onManageCourses={() => setActiveTab('courses')}
            onViewCourseStudents={(courseId) => {
              setStudentCourseFilter(courseId);
              setActiveTab('students');
            }}
            onEditCourse={(course) => {
              setEditingCourse(course);
              setCourseModalOpen(true);
            }}
            onRestoreDefaults={handleRestoreDefaults}
          />

          {/* Recent Activity Log Preview */}
          <ActivityLogSection
            logs={activityLogs}
            loading={loading}
            compact
            onViewAll={() => setActiveTab('activity')}
          />
        </div>
      )}

      {/* COURSES TAB */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Computer Diploma Courses
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Office Management, Graphic Designing, Digital Marketing, Web Development, and AI
                Tutor.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Default 5 Courses</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCourse(null);
                  setCourseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Course</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const enrolledCount = enrollments.filter(
                (e) => e.courseId === course.id && e.status === 'active'
              ).length;
              return (
                <article
                  key={course.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                    <CourseThumbnail
                      imageKey={course.imageKey}
                      title={course.title}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-slate-500 tabular-nums">
                        {course.code} · {course.durationMonths} Months
                      </div>
                      <StatusText status={course.status} />
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-slate-950">{course.title}</h2>
                    <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                      {course.description}
                    </p>

                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Instructor</span>
                        <span className="font-medium text-slate-900">
                          {course.teacherName || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Enrolled</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {enrolledCount} student(s)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Monthly Fee</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          PKR {course.feeMonthly.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCourse(course);
                          setCourseModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteCourse(course.id);
                          recordAdminAction(
                            'course',
                            'Deleted Course',
                            `Deleted course ${course.code} · ${course.title}.`,
                            course.title
                          );
                          notify(`Deleted course ${course.title}.`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TEACHERS TAB */}
      {activeTab === 'teachers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Teachers &amp; Faculty Access
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Only teachers added here can sign into the Teacher Portal using their Google email.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTeacher(null);
                setTeacherModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Teacher</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 p-4 flex items-center gap-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Search teachers by name, email, or specialization..."
                className="w-full text-sm focus:outline-none"
              />
            </div>

            {filteredTeachers.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">No teachers added yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add a faculty member with their Google email to grant Teacher Portal access.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeacher(null);
                    setTeacherModalOpen(true);
                  }}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Add First Teacher
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Faculty Name</th>
                      <th className="px-5 py-3">Google Login Email</th>
                      <th className="px-5 py-3">Assigned Courses</th>
                      <th className="px-5 py-3">Login Access</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map((teacher) => {
                      const inv = inviteByEmail.get(teacher.email.toLowerCase());
                      const inviteStatus = inv?.status || (teacher.status === 'active' ? 'active' : 'suspended');
                      const assignedTitles = courses
                        .filter((c) => teacher.assignedCourseIds.includes(c.id))
                        .map((c) => c.title);

                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{teacher.fullName}</div>
                            <div className="text-xs text-slate-500">
                              {teacher.qualification} · {teacher.phone || 'No phone'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                            {teacher.email}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">
                            {assignedTitles.length > 0 ? assignedTitles.join(' · ') : 'None assigned'}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = inviteStatus === 'active' ? 'suspended' : 'active';
                                await toggleInviteStatus(teacher.email, next);
                                recordAdminAction(
                                  'access',
                                  `${next === 'active' ? 'Activated' : 'Suspended'} Teacher Login`,
                                  `Changed Teacher Portal access for ${teacher.fullName} (${teacher.email}) to ${next}.`,
                                  teacher.fullName
                                );
                                notify(`Set ${teacher.fullName} login to ${next}.`);
                              }}
                              title="Toggle portal login access"
                              className="hover:underline"
                            >
                              <StatusText status={inviteStatus} />
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTeacher(teacher);
                                setTeacherModalOpen(true);
                              }}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteTeacherWithInvite(teacher);
                                recordAdminAction(
                                  'teacher',
                                  'Removed Teacher',
                                  `Removed teacher ${teacher.fullName} (${teacher.email}) and revoked Teacher Portal access.`,
                                  teacher.fullName
                                );
                                notify(`Removed teacher ${teacher.fullName}.`);
                              }}
                              className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Remove
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
        </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Enrolled Diploma Students
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Only students added here can sign into the Student Portal with their Google email.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingStudent(null);
                setStudentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Enroll Student</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by roll no, student name, email, or parent email..."
                  className="w-full text-sm focus:outline-none"
                />
              </div>
              <select
                value={studentCourseFilter}
                onChange={(e) => setStudentCourseFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
              >
                <option value="all">All 5 Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">No students found</p>
                <p className="mt-1 text-xs text-slate-500">
                  Enroll a student to assign diploma tracks and activate their Student Portal login.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentModalOpen(true);
                  }}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Enroll First Student
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Roll No</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Enrolled Courses</th>
                      <th className="px-5 py-3">Parent Link</th>
                      <th className="px-5 py-3">Fee Status</th>
                      <th className="px-5 py-3">Login Access</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const inv = inviteByEmail.get(student.email.toLowerCase());
                      const inviteStatus =
                        inv?.status || (student.status === 'suspended' ? 'suspended' : 'active');
                      const enrolledTitles = courses
                        .filter((c) => student.courseIds.includes(c.id))
                        .map((c) => c.title);

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                            {student.rollNumber}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{student.fullName}</div>
                            <div className="font-mono text-xs text-slate-500">{student.email}</div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-700">
                            <div>{enrolledTitles.join(' · ') || 'Unassigned'}</div>
                            <div className="text-slate-400 mt-0.5">{student.batch}</div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">
                            <div>{student.parentName || 'Not linked'}</div>
                            {student.parentEmail && (
                              <div className="font-mono text-slate-400">{student.parentEmail}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusText status={student.feeStatus} />
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = inviteStatus === 'active' ? 'suspended' : 'active';
                                await toggleInviteStatus(student.email, next);
                                recordAdminAction(
                                  'access',
                                  `${next === 'active' ? 'Activated' : 'Suspended'} Student Login`,
                                  `Changed Student Portal access for ${student.fullName} (${student.rollNumber}) to ${next}.`,
                                  student.fullName
                                );
                                notify(`Set ${student.fullName} login to ${next}.`);
                              }}
                              className="hover:underline"
                            >
                              <StatusText status={inviteStatus} />
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent(student);
                                setStudentModalOpen(true);
                              }}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteStudentWithInvite(student);
                                recordAdminAction(
                                  'student',
                                  'Removed Student',
                                  `Removed student ${student.fullName} (${student.rollNumber}) and revoked Student Portal access.`,
                                  student.fullName
                                );
                                notify(`Removed student ${student.fullName}.`);
                              }}
                              className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Remove
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
        </div>
      )}

      {/* PARENTS TAB */}
      {activeTab === 'parents' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Parents &amp; Guardians
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Only parents added here can sign into the Parent Portal to monitor their linked
                student(s).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingParent(null);
                setParentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Parent</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 p-4 flex items-center gap-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder="Search parents by name, email, or phone..."
                className="w-full text-sm focus:outline-none"
              />
            </div>

            {filteredParents.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">No parents added yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Add a parent or guardian and link their child to enable Parent Portal login.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingParent(null);
                    setParentModalOpen(true);
                  }}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Add First Parent
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Parent / Guardian</th>
                      <th className="px-5 py-3">Google Login Email</th>
                      <th className="px-5 py-3">Linked Students</th>
                      <th className="px-5 py-3">Login Access</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParents.map((parent) => {
                      const inv = inviteByEmail.get(parent.email.toLowerCase());
                      const inviteStatus =
                        inv?.status || (parent.status === 'active' ? 'active' : 'suspended');
                      const linkedNames = students
                        .filter((s) => parent.linkedStudentIds.includes(s.id))
                        .map((s) => `${s.fullName} (${s.rollNumber})`);

                      return (
                        <tr key={parent.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{parent.fullName}</div>
                            <div className="text-xs text-slate-500">
                              {parent.relationship} · {parent.phone || 'No phone'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                            {parent.email}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-700">
                            {linkedNames.length > 0 ? linkedNames.join(' · ') : 'No linked student'}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = inviteStatus === 'active' ? 'suspended' : 'active';
                                await toggleInviteStatus(parent.email, next);
                                recordAdminAction(
                                  'access',
                                  `${next === 'active' ? 'Activated' : 'Suspended'} Parent Login`,
                                  `Changed Parent Portal access for ${parent.fullName} (${parent.email}) to ${next}.`,
                                  parent.fullName
                                );
                                notify(`Set ${parent.fullName} login to ${next}.`);
                              }}
                              className="hover:underline"
                            >
                              <StatusText status={inviteStatus} />
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingParent(parent);
                                setParentModalOpen(true);
                              }}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteParentWithInvite(parent);
                                recordAdminAction(
                                  'parent',
                                  'Removed Parent',
                                  `Removed parent ${parent.fullName} (${parent.email}) and revoked Parent Portal access.`,
                                  parent.fullName
                                );
                                notify(`Removed parent ${parent.fullName}.`);
                              }}
                              className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Remove
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
        </div>
      )}

      {/* ATTENDANCE & GRADES TAB */}
      {activeTab === 'academics' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Attendance &amp; Assessment Grades
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Record daily attendance and diploma exam scores across all 5 courses.
              </p>
            </div>
            <div className="inline-flex rounded-lg bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => setAcademicsMode('attendance')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  academicsMode === 'attendance'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Daily Attendance
              </button>
              <button
                type="button"
                onClick={() => setAcademicsMode('grades')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  academicsMode === 'grades'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Assessment Grades
              </button>
            </div>
          </div>

          {academicsMode === 'attendance' ? (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 p-4 flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Diploma Course
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-700 focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              {courseEnrollments.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No active students enrolled in this course yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-5 py-3">Roll No</th>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Remarks</th>
                        <th className="px-5 py-3">Recorded Status</th>
                        <th className="px-5 py-3 text-right">Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {courseEnrollments.map((enr) => {
                        const existing = attendanceMapForDay.get(enr.studentId);
                        const remarkVal =
                          attendanceRemarks[enr.studentId] ?? existing?.remarks ?? '';
                        return (
                          <tr key={enr.id} className="hover:bg-slate-50/70">
                            <td className="px-5 py-3 font-mono text-xs text-slate-600">
                              {enr.studentRollNumber}
                            </td>
                            <td className="px-5 py-3 font-medium text-slate-900">
                              {enr.studentName}
                            </td>
                            <td className="px-5 py-3">
                              <input
                                type="text"
                                value={remarkVal}
                                onChange={(e) =>
                                  setAttendanceRemarks((prev) => ({
                                    ...prev,
                                    [enr.studentId]: e.target.value,
                                  }))
                                }
                                placeholder="Optional note..."
                                className="w-full max-w-[200px] rounded border border-slate-200 px-2.5 py-1 text-xs focus:border-blue-700 focus:outline-none"
                              />
                            </td>
                            <td className="px-5 py-3">
                              {existing ? (
                                <StatusText status={existing.status} />
                              ) : (
                                <span className="text-xs text-slate-400">Not marked</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                              {(['present', 'late', 'absent'] as const).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={async () => {
                                    await markAttendanceRecord({
                                      date: attendanceDate,
                                      enrollment: enr,
                                      status: st,
                                      remarks: remarkVal,
                                      markedBy: user.email || '',
                                    });
                                    recordAdminAction(
                                      'attendance',
                                      'Marked Attendance',
                                      `Marked ${enr.studentName} (${enr.studentRollNumber}) as ${st} in ${enr.courseTitle} for ${attendanceDate}.`,
                                      enr.studentName
                                    );
                                    notify(`Marked ${enr.studentName} as ${st}.`);
                                  }}
                                  className={`rounded px-2.5 py-1 text-xs font-semibold capitalize border transition-colors ${
                                    existing?.status === st
                                      ? 'border-blue-700 bg-blue-700 text-white'
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
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={enrollments.length === 0}
                  onClick={() => {
                    setEditingGrade(null);
                    setGradeModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <Award className="h-3.5 w-3.5" />
                  <span>Add Assessment Grade</span>
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {grades.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    No assessment grades recorded yet.
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
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grades.map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50/70">
                            <td className="px-5 py-3">
                              <div className="font-semibold text-slate-900">{g.studentName}</div>
                              <div className="font-mono text-xs text-slate-500">
                                {g.studentRollNumber}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-xs text-slate-700">{g.courseTitle}</td>
                            <td className="px-5 py-3 text-slate-800">{g.assessmentTitle}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                              {g.score} / {g.maxScore}
                            </td>
                            <td className="px-5 py-3 font-mono font-bold text-blue-700">
                              {g.gradeLetter}
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-slate-500">
                              {g.gradedDate}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
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
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteGradeRecord(g.id);
                                  recordAdminAction(
                                    'grade',
                                    'Deleted Assessment Grade',
                                    `Deleted grade "${g.assessmentTitle}" for ${g.studentName} (${g.courseTitle}).`,
                                    g.studentName
                                  );
                                  notify('Deleted grade entry.');
                                }}
                                className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                              >
                                Delete
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
        </div>
      )}

      {/* FEES TAB */}
      {activeTab === 'fees' && (
        <FeeManagement
          fees={fees}
          students={students}
          courses={courses}
          onCreateVoucher={(studentId) => {
            setEditingFee(null);
            setDefaultFeeStudentId(studentId);
            setFeeModalOpen(true);
          }}
          onEditVoucher={(fee) => {
            setDefaultFeeStudentId(undefined);
            setEditingFee(fee);
            setFeeModalOpen(true);
          }}
          onDeleteVoucher={async (fee) => {
            await deleteFeeRecord(fee.id);
            recordAdminAction(
              'fee',
              'Deleted Fee Voucher',
              `Deleted fee voucher ${fee.receiptNo} for ${fee.studentName} (${fee.monthLabel}).`,
              fee.studentName
            );
            notify(`Deleted fee voucher ${fee.receiptNo}.`);
          }}
          onRecordPayment={async ({ fee, paymentAmount, paidDate, notes }) => {
            const result = await recordFeePayment({
              fee,
              paymentAmount,
              paidDate,
              notes,
            });
            recordAdminAction(
              'fee',
              'Recorded Fee Payment',
              `Recorded PKR ${paymentAmount.toLocaleString()} payment on receipt ${fee.receiptNo} for ${fee.studentName} (${result.nextStatus}).`,
              fee.studentName
            );
            notify(`Recorded PKR ${paymentAmount.toLocaleString()} for ${fee.studentName}.`);
            return result;
          }}
          onNotify={notify}
        />
      )}

      {/* ANNOUNCEMENTS TAB */}
      {activeTab === 'announcements' && (
        <AnnouncementsBoard
          announcements={announcements}
          courses={courses}
          authorName={user.displayName || 'Institute Admin'}
          authorEmail={user.email || ''}
          onPublishDirect={async (data) => {
            await saveAnnouncement(data, false);
            recordAdminAction(
              'announcement',
              'Published Announcement',
              `${data.title} (Audience: ${data.targetRole} · ${data.courseTitle}).`,
              data.title
            );
            notify(`Published notice "${data.title}".`);
          }}
          onOpenCreateModal={() => {
            setEditingAnnouncement(null);
            setAnnouncementModalOpen(true);
          }}
          onEditAnnouncement={(ann) => {
            setEditingAnnouncement(ann);
            setAnnouncementModalOpen(true);
          }}
          onDeleteAnnouncement={async (ann) => {
            await deleteAnnouncement(ann.id);
            recordAdminAction(
              'announcement',
              'Deleted Announcement',
              `Deleted announcement "${ann.title}".`,
              ann.title
            );
            notify('Deleted announcement.');
          }}
        />
      )}

      {/* ACTIVITY LOG TAB */}
      {activeTab === 'activity' && (
        <ActivityLogSection
          logs={activityLogs}
          loading={loading}
          onDeleteLog={async (logId) => {
            await deleteActivityLog(logId);
            notify('Removed activity log entry.');
          }}
        />
      )}

      {/* LEADS AI TAB */}
      {activeTab === 'leads-ai' && (
        <LeadsAIHub userRole="admin" userName={user.displayName || 'Institute Admin'} />
      )}

      {/* ALL MODALS */}
      <CourseModal
        open={courseModalOpen}
        initial={editingCourse}
        teachers={teachers}
        onClose={() => setCourseModalOpen(false)}
        onSave={async (data, isEdit) => {
          await saveCourse(data, isEdit);
          recordAdminAction(
            'course',
            isEdit ? 'Updated Course' : 'Created Course',
            `${isEdit ? 'Updated' : 'Created'} course ${data.code} · ${data.title} (PKR ${data.feeMonthly.toLocaleString()}/mo).`,
            data.title
          );
          notify(isEdit ? `Updated ${data.title}.` : `Created course ${data.title}.`);
        }}
      />

      <TeacherModal
        open={teacherModalOpen}
        initial={editingTeacher}
        courses={courses}
        onClose={() => setTeacherModalOpen(false)}
        onSave={async (data, isEdit, prevEmail) => {
          await saveTeacherWithInvite(data, courses, isEdit, prevEmail);
          recordAdminAction(
            'teacher',
            isEdit ? 'Updated Teacher' : 'Added Teacher',
            `${isEdit ? 'Updated' : 'Added'} teacher ${data.fullName} (${data.email}) with ${data.assignedCourseIds.length} assigned course(s).`,
            data.fullName
          );
          notify(
            isEdit
              ? `Updated teacher ${data.fullName}.`
              : `Added ${data.fullName} and enabled Teacher Portal login for ${data.email}.`
          );
        }}
      />

      <StudentModal
        open={studentModalOpen}
        initial={editingStudent}
        courses={courses}
        parents={parents}
        nextRollNumber={nextRollNumber}
        onClose={() => setStudentModalOpen(false)}
        onSave={async (data, isEdit, prevEmail) => {
          await saveStudentWithInvite(data, courses, isEdit, prevEmail);
          recordAdminAction(
            'student',
            isEdit ? 'Updated Student' : 'Enrolled Student',
            `${isEdit ? 'Updated' : 'Enrolled'} ${data.fullName} (${data.rollNumber}, ${data.email}) in ${data.courseIds.length} course(s).`,
            data.fullName
          );
          notify(
            isEdit
              ? `Updated student ${data.fullName}.`
              : `Enrolled ${data.fullName} and enabled Student Portal login for ${data.email}.`
          );
        }}
      />

      <ParentModal
        open={parentModalOpen}
        initial={editingParent}
        students={students}
        onClose={() => setParentModalOpen(false)}
        onSave={async (data, isEdit, prevEmail) => {
          await saveParentWithInvite(data, students, isEdit, prevEmail);
          recordAdminAction(
            'parent',
            isEdit ? 'Updated Parent' : 'Added Parent',
            `${isEdit ? 'Updated' : 'Added'} parent ${data.fullName} (${data.email}) linked to ${data.linkedStudentIds.length} student(s).`,
            data.fullName
          );
          notify(
            isEdit
              ? `Updated parent ${data.fullName}.`
              : `Added ${data.fullName} and enabled Parent Portal login for ${data.email}.`
          );
        }}
      />

      <GradeModal
        open={gradeModalOpen}
        initial={editingGrade}
        enrollments={enrollments}
        gradedBy={user.email || ''}
        onClose={() => setGradeModalOpen(false)}
        onSave={async (payload, isEdit) => {
          await saveGradeRecord(payload, isEdit);
          recordAdminAction(
            'grade',
            isEdit ? 'Updated Assessment Grade' : 'Recorded Assessment Grade',
            `${payload.assessmentTitle}: ${payload.score}/${payload.maxScore} for ${payload.enrollment.studentName} (${payload.enrollment.courseTitle}).`,
            payload.enrollment.studentName
          );
          notify('Saved assessment grade.');
        }}
      />

      <FeeModal
        open={feeModalOpen}
        initial={editingFee}
        defaultStudentId={defaultFeeStudentId}
        students={students}
        courses={courses}
        onClose={() => {
          setFeeModalOpen(false);
          setDefaultFeeStudentId(undefined);
        }}
        onSave={async (data, isEdit) => {
          await saveFeeRecord(data, isEdit);
          recordAdminAction(
            'fee',
            isEdit ? 'Updated Fee Voucher' : 'Created Fee Voucher',
            `${data.monthLabel} voucher (${data.receiptNo}) for ${data.studentName}: PKR ${data.paidAmount.toLocaleString()}/${data.amount.toLocaleString()} (${data.status}).`,
            data.studentName
          );
          notify('Saved fee record.');
        }}
      />

      <AnnouncementModal
        open={announcementModalOpen}
        initial={editingAnnouncement}
        courses={courses}
        authorName={user.displayName || 'Institute Admin'}
        authorEmail={user.email || ''}
        authorRole="admin"
        onClose={() => setAnnouncementModalOpen(false)}
        onSave={async (data, isEdit) => {
          await saveAnnouncement(data, isEdit);
          recordAdminAction(
            'announcement',
            isEdit ? 'Updated Announcement' : 'Published Announcement',
            `${data.title} (Audience: ${data.targetRole} · ${data.courseTitle}).`,
            data.title
          );
          notify('Published announcement.');
        }}
      />
    </AppShell>
  );
}
