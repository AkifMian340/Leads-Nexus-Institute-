import {
  GraduationCap,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { AnnouncementRecord, CourseRecord } from '../../types/institute';

interface AnnouncementsBoardProps {
  announcements: AnnouncementRecord[];
  courses: CourseRecord[];
  authorName: string;
  authorEmail: string;
  onPublishDirect: (data: Omit<AnnouncementRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onOpenCreateModal: () => void;
  onEditAnnouncement: (ann: AnnouncementRecord) => void;
  onDeleteAnnouncement: (ann: AnnouncementRecord) => Promise<void>;
}

type AudienceFilter = 'all_items' | 'all' | 'student' | 'teacher' | 'parent';

function formatTimestamp(ann: AnnouncementRecord): string {
  if (!ann.createdAt) return 'Just now';
  try {
    const date = ann.createdAt.toDate();
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recorded';
  }
}

function describeAudienceReach(targetRole: AnnouncementRecord['targetRole']): string {
  switch (targetRole) {
    case 'all':
      return 'Student, Teacher & Parent Portals';
    case 'student':
      return 'Student Portal Only';
    case 'teacher':
      return 'Teacher Portal Only';
    case 'parent':
      return 'Parent Portal Only';
  }
}

export function AnnouncementsBoard({
  announcements,
  courses,
  authorName,
  authorEmail,
  onPublishDirect,
  onOpenCreateModal,
  onEditAnnouncement,
  onDeleteAnnouncement,
}: AnnouncementsBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all_items');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Quick composer state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'student' | 'teacher' | 'parent'>('all');
  const [courseId, setCourseId] = useState('all');
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      const aMs = a.createdAt?.toMillis?.() ?? 0;
      const bMs = b.createdAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
  }, [announcements]);

  const stats = useMemo(() => {
    const total = sortedAnnouncements.length;
    const allPortals = sortedAnnouncements.filter((a) => a.targetRole === 'all').length;
    const studentVisible = sortedAnnouncements.filter(
      (a) => a.targetRole === 'all' || a.targetRole === 'student'
    ).length;
    const teacherVisible = sortedAnnouncements.filter(
      (a) => a.targetRole === 'all' || a.targetRole === 'teacher'
    ).length;

    return { total, allPortals, studentVisible, teacherVisible };
  }, [sortedAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedAnnouncements.filter((ann) => {
      if (audienceFilter !== 'all_items' && ann.targetRole !== audienceFilter) return false;
      if (courseFilter !== 'all' && ann.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        ann.title.toLowerCase().includes(q) ||
        ann.body.toLowerCase().includes(q) ||
        ann.courseTitle.toLowerCase().includes(q) ||
        ann.authorName.toLowerCase().includes(q)
      );
    });
  }, [sortedAnnouncements, audienceFilter, courseFilter, searchQuery]);

  const hasFilters =
    searchQuery.trim() !== '' || audienceFilter !== 'all_items' || courseFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setAudienceFilter('all_items');
    setCourseFilter('all');
  };

  const handleQuickPublish = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setComposerError('Notice title and message body are required.');
      return;
    }

    setPosting(true);
    setComposerError(null);
    try {
      const selectedCourse = courses.find((c) => c.id === courseId);
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await onPublishDirect({
        id,
        title: title.trim(),
        body: body.trim(),
        targetRole,
        courseId,
        courseTitle: selectedCourse ? selectedCourse.title : 'All Courses',
        authorName,
        authorEmail,
        authorRole: 'admin',
      });
      setTitle('');
      setBody('');
      setTargetRole('all');
      setCourseId('all');
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Unable to publish notice.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Announcements Board</h1>
          <p className="mt-1 text-sm text-slate-600">
            Post official institute notices that appear live on Student, Teacher, and Parent portals.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Notice Modal</span>
        </button>
      </div>

      {/* Audience Reach KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Published</span>
            <Megaphone className="h-4 w-4 text-blue-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active institute notices</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>All-Portal Broadcasts</span>
            <Users className="h-4 w-4 text-slate-600" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-950">
            {stats.allPortals}
          </div>
          <div className="mt-1 text-xs text-slate-500">Shared across all roles</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Live on Student Portal</span>
            <GraduationCap className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-emerald-700">
            {stats.studentVisible}
          </div>
          <div className="mt-1 text-xs text-slate-500">Visible to enrolled students</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Live on Teacher Portal</span>
            <UserCheck className="h-4 w-4 text-blue-700" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-blue-700">
            {stats.teacherVisible}
          </div>
          <div className="mt-1 text-xs text-slate-500">Visible to assigned faculty</div>
        </div>
      </div>

      {/* Main Board Split: Quick Notice Composer + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quick Compose Panel */}
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-950">Quick Post Notice</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Publish directly to selected portals without leaving the board.
            </p>
          </div>

          <form onSubmit={handleQuickPublish} className="space-y-3.5">
            {composerError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {composerError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notice Title
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Lab Assessment Schedule"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Portals
              </label>
              <select
                value={targetRole}
                onChange={(e) =>
                  setTargetRole(e.target.value as 'all' | 'student' | 'teacher' | 'parent')
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              >
                <option value="all">All Portals (Students, Teachers &amp; Parents)</option>
                <option value="student">Students Only</option>
                <option value="teacher">Teachers Only</option>
                <option value="parent">Parents Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Scope
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notice Message
              </label>
              <textarea
                rows={4}
                required
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write instructions, timings, or updates for recipients..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Reach: <span className="font-semibold text-slate-700">{describeAudienceReach(targetRole)}</span>
              </div>
              <button
                type="submit"
                disabled={posting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{posting ? 'Publishing...' : 'Publish Notice'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Published Notice Feed */}
        <section className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notices by title, message, or author..."
                  className="w-full text-xs focus:outline-none"
                />
              </div>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="Filter notices by course"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>

              {hasFilters && (
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

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start xl:self-auto">
              {(
                [
                  { id: 'all_items', label: 'All' },
                  { id: 'all', label: 'All Portals' },
                  { id: 'student', label: 'Students' },
                  { id: 'teacher', label: 'Teachers' },
                  { id: 'parent', label: 'Parents' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAudienceFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    audienceFilter === tab.id
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {sortedAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No announcements posted yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Use the Quick Post Notice form to broadcast updates to Student, Teacher, and Parent
                portals.
              </p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No notices match your current filters
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Reset filters to view all published announcements.
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
            <div className="space-y-4">
              {filteredAnnouncements.map((ann) => (
                <article
                  key={ann.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-blue-700">
                          {describeAudienceReach(ann.targetRole)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{ann.courseTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          By {ann.authorName} ({ann.authorRole})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{formatTimestamp(ann)}</span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-slate-950">{ann.title}</h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditAnnouncement(ann)}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAnnouncement(ann)}
                        className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                    {ann.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
