import { User } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Lock,
  LogOut,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { DEFAULT_DIPLOMA_COURSES, HERO_CAMPUS_IMAGE } from '../data/defaultCourses';
import { ADMIN_EMAIL } from '../lib/firebase';
import { InviteRecord, UserRole } from '../types/institute';
import { CourseThumbnail } from './ui/CourseThumbnail';

interface AuthGateProps {
  user: User | null;
  authLoading: boolean;
  selectedPortal: UserRole;
  onSelectPortal: (role: UserRole) => void;
  invite: InviteRecord | null;
  inviteChecked: boolean;
  authError: string | null;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  confirmedRole: UserRole | null;
  onConfirmRoleOverride: (role: UserRole) => void;
}

const PORTAL_OPTIONS: {
  role: UserRole;
  title: string;
  subtitle: string;
  accessNote: string;
  icon: ReactNode;
}[] = [
  {
    role: 'admin',
    title: 'Admin Portal',
    subtitle: 'Institute Governance',
    accessNote: `Full access for ${ADMIN_EMAIL}`,
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    role: 'teacher',
    title: 'Teacher Portal',
    subtitle: 'Faculty & Grading',
    accessNote: 'Admin-added instructors',
    icon: <UserCheck className="h-5 w-5" />,
  },
  {
    role: 'student',
    title: 'Student Portal',
    subtitle: 'Diploma Academics',
    accessNote: 'Admin-added students',
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    role: 'parent',
    title: 'Parent Portal',
    subtitle: 'Guardian Tracking',
    accessNote: 'Admin-added parents',
    icon: <Users className="h-5 w-5" />,
  },
];

export function AuthGate({
  user,
  authLoading,
  selectedPortal,
  onSelectPortal,
  invite,
  inviteChecked,
  authError,
  onGoogleSignIn,
  onSignOut,
  confirmedRole,
  onConfirmRoleOverride,
}: AuthGateProps) {
  const [heroImgError, setHeroImgError] = useState(false);

  // If user is signed in, show verification / restriction screens until authorized
  if (user) {
    const email = (user.email || '').toLowerCase();
    const isAdminEmail = email === ADMIN_EMAIL && user.emailVerified;

    if (!inviteChecked && !isAdminEmail) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
            <h2 className="text-lg font-bold text-slate-900">Verifying Institute Access</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Checking authorization for <span className="font-mono text-slate-700">{email}</span>
            </p>
          </div>
        </div>
      );
    }

    if (!isAdminEmail && (!invite || invite.status === 'suspended')) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
            <div className="flex items-center gap-3 text-rose-700">
              <Lock className="h-6 w-6 shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">
                {invite?.status === 'suspended'
                  ? 'Portal Access Suspended'
                  : 'Invite-Only Portal Access'}
              </h1>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              {invite?.status === 'suspended' ? (
                <>
                  Your account (<span className="font-mono text-slate-900">{email}</span>) is
                  currently suspended by the Leads Nexus Institute administrator.
                </>
              ) : (
                <>
                  The Google account <span className="font-mono text-slate-900">{email}</span> has
                  not been added to the Leads Nexus Institute directory yet.
                </>
              )}
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
              Access to Teacher, Student, and Parent portals is strictly limited to users added by
              the institute administrator (<span className="font-mono text-slate-800">{ADMIN_EMAIL}</span>).
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out & Switch Account</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Check if user clicked a different portal card than their authorized invite role
    const actualRole: UserRole = isAdminEmail ? 'admin' : invite!.role;
    if (!confirmedRole && selectedPortal !== actualRole) {
      const portalLabel =
        actualRole.charAt(0).toUpperCase() + actualRole.slice(1) + ' Portal';
      const selectedLabel =
        selectedPortal.charAt(0).toUpperCase() + selectedPortal.slice(1) + ' Portal';

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8">
            <h1 className="text-xl font-bold text-slate-900">Portal Role Notice</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You selected <span className="font-semibold text-slate-900">{selectedLabel}</span>,
              but <span className="font-mono text-slate-900">{email}</span> is authorized for the{' '}
              <span className="font-semibold text-blue-700">{portalLabel}</span>.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={() => onConfirmRoleOverride(actualRole)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
              >
                <span>Enter {portalLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  const activePortalMeta = PORTAL_OPTIONS.find((p) => p.role === selectedPortal)!;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            Leads Nexus Institute
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#portals"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Portal Login
            </a>
            <a
              href="#diploma-courses"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Diploma Courses
            </a>
            <a
              href="#access-policy"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Access Policy
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={authLoading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {authLoading ? 'Signing In...' : 'Portal Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Hero + 4-Way Portal Login */}
      <section id="portals" className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: 4-Way Login Selection */}
          <div className="lg:col-span-7 px-6 py-10 sm:py-14 lg:pr-12 flex flex-col justify-center">
            <div className="text-xs font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span>Computer Diploma Programs</span>
              <span aria-hidden="true">·</span>
              <span>5 Specialized Tracks</span>
              <span aria-hidden="true">·</span>
              <span>Invite-Only Access</span>
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 [text-wrap:balance] max-w-2xl">
              Academic &amp; Administration Portal for Leads Nexus Institute
            </h1>

            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              Select your designated portal below and authenticate with your authorized Google
              account. Faculty, student, and parent accounts are provisioned directly by the
              institute administrator.
            </p>

            {/* 4-Way Portal Cards */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PORTAL_OPTIONS.map((option) => {
                const isSelected = selectedPortal === option.role;
                return (
                  <button
                    key={option.role}
                    type="button"
                    onClick={() => onSelectPortal(option.role)}
                    className={`flex items-start gap-3.5 rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-700 bg-blue-50/50 ring-1 ring-blue-700'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                        isSelected
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {option.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-950">{option.title}</div>
                      <div className="text-xs font-medium text-slate-600 mt-0.5">
                        {option.subtitle}
                      </div>
                      <div className="mt-1.5 text-xs text-slate-500 truncate">
                        {option.accessNote}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {authError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {authError}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={authLoading}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <span>
                  {authLoading
                    ? 'Connecting to Google...'
                    : `Continue to ${activePortalMeta.title}`}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>

              <span className="text-xs text-slate-500">
                Administrator account: <span className="font-mono text-slate-700">{ADMIN_EMAIL}</span>
              </span>
            </div>
          </div>

          {/* Right Column: Campus Visual + 5 Diploma Tracks Overview */}
          <div className="lg:col-span-5 relative min-h-[380px] lg:min-h-[560px] bg-slate-900 overflow-hidden">
            {!heroImgError ? (
              <img
                src={HERO_CAMPUS_IMAGE}
                alt="Leads Nexus Institute Computer Diploma Lab"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400">
                <BookOpen className="h-12 w-12" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/15" />

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
              <div className="text-xs font-medium text-slate-300">
                Accredited Curriculum · 5 Diploma Tracks
              </div>
              <h2 className="mt-1.5 text-xl font-bold text-white">
                Career-Focused Computer Education
              </h2>
              <ol className="mt-4 space-y-1.5 text-sm text-slate-200 border-t border-white/15 pt-4">
                {DEFAULT_DIPLOMA_COURSES.map((course, idx) => (
                  <li key={course.id} className="flex items-center justify-between gap-4">
                    <span className="truncate">
                      <span className="font-mono text-xs text-slate-400 mr-2">
                        0{idx + 1}.
                      </span>
                      {course.title}
                    </span>
                    <span className="font-mono text-xs text-slate-300 tabular-nums shrink-0">
                      {course.durationMonths} mo
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Diploma Courses Catalog Section */}
      <section id="diploma-courses" className="mx-auto max-w-7xl w-full px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
              Five Computer Diploma Programs
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
              Structured technical training with hands-on lab modules, instructor assessments, and
              parent progress visibility.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
            5 Active Tracks · Academic Year 2026
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEFAULT_DIPLOMA_COURSES.map((course, idx) => (
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
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <span>0{idx + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span>{course.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{course.durationMonths} Months</span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-950">{course.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 flex-1">
                  {course.description}
                </p>
                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">{course.schedule}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0 ml-2">
                    PKR {course.feeMonthly.toLocaleString()}/mo
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Access Policy Footer */}
      <footer
        id="access-policy"
        className="mt-auto border-t border-slate-200 bg-white py-8 px-6"
      >
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-900">Leads Nexus Institute</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Computer Diploma Administration &amp; Academic Portal</span>
          </div>
          <div>
            Authorized access managed by{' '}
            <span className="font-mono text-slate-700">{ADMIN_EMAIL}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
