import { FormEvent, useEffect, useState } from 'react';
import { COURSE_IMAGES } from '../../data/defaultCourses';
import {
  computeLetterGrade,
  isValidEmailFormat,
  makeSafeId,
  normalizeEmail,
} from '../../services/instituteService';
import {
  AnnouncementRecord,
  CourseRecord,
  EnrollmentRecord,
  FeeRecord,
  GradeRecord,
  ParentRecord,
  StudentRecord,
  TeacherRecord,
} from '../../types/institute';
import { Modal } from '../ui/Modal';

// -----------------------------------------------------------------------------
// Course Modal
// -----------------------------------------------------------------------------
interface CourseModalProps {
  open: boolean;
  initial: CourseRecord | null;
  teachers: TeacherRecord[];
  onClose: () => void;
  onSave: (data: Omit<CourseRecord, 'createdAt' | 'updatedAt'>, isEdit: boolean) => Promise<void>;
}

export function CourseModal({ open, initial, teachers, onClose, onSave }: CourseModalProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMonths, setDurationMonths] = useState(6);
  const [feeMonthly, setFeeMonthly] = useState(5000);
  const [schedule, setSchedule] = useState('Mon - Fri · 09:00 AM - 11:00 AM');
  const [teacherId, setTeacherId] = useState('');
  const [modulesText, setModulesText] = useState('');
  const [imageKey, setImageKey] = useState('office-management');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setCode(initial.code);
      setTitle(initial.title);
      setDescription(initial.description);
      setDurationMonths(initial.durationMonths);
      setFeeMonthly(initial.feeMonthly);
      setSchedule(initial.schedule);
      setTeacherId(initial.teacherId || '');
      setModulesText(initial.modules.join('\n'));
      setImageKey(initial.imageKey || 'office-management');
      setStatus(initial.status);
    } else {
      setCode('');
      setTitle('');
      setDescription('');
      setDurationMonths(6);
      setFeeMonthly(5500);
      setSchedule('Mon - Fri · 10:00 AM - 12:00 PM');
      setTeacherId('');
      setModulesText('01. Core Foundations\n02. Applied Lab Practice\n03. Final Diploma Project');
      setImageKey('office-management');
      setStatus('active');
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      setError('Course code and title are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const assignedTeacher = teachers.find((t) => t.id === teacherId);
      await onSave(
        {
          id: initial?.id || makeSafeId('crs'),
          code: code.trim(),
          title: title.trim(),
          description: description.trim(),
          durationMonths: Number(durationMonths) || 6,
          feeMonthly: Number(feeMonthly) || 0,
          schedule: schedule.trim(),
          teacherId: assignedTeacher ? assignedTeacher.id : '',
          teacherName: assignedTeacher ? assignedTeacher.fullName : 'Unassigned',
          teacherEmail: assignedTeacher ? assignedTeacher.email : '',
          modules: modulesText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          imageKey,
          status,
        },
        Boolean(initial)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Edit Course · ${initial.title}` : 'Add Diploma Course'}
      subtitle="Manage syllabus modules, monthly fee, schedule, and assigned faculty."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WD-104"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Web Development"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Duration (Months)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Fee (PKR)
            </label>
            <input
              type="number"
              min={0}
              value={feeMonthly}
              onChange={(e) => setFeeMonthly(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Teacher
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} ({t.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Class Schedule</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Mon - Fri · 09:00 AM - 11:00 AM"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Cover Theme</label>
          <select
            value={imageKey}
            onChange={(e) => setImageKey(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
          >
            {Object.keys(COURSE_IMAGES).map((key) => (
              <option key={key} value={key}>
                {key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Syllabus Modules (one per line)
          </label>
          <textarea
            rows={5}
            value={modulesText}
            onChange={(e) => setModulesText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Course'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Teacher Modal
// -----------------------------------------------------------------------------
interface TeacherModalProps {
  open: boolean;
  initial: TeacherRecord | null;
  courses: CourseRecord[];
  onClose: () => void;
  onSave: (
    data: Omit<TeacherRecord, 'createdAt' | 'updatedAt'>,
    isEdit: boolean,
    previousEmail?: string
  ) => Promise<void>;
}

export function TeacherModal({ open, initial, courses, onClose, onSave }: TeacherModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [assignedCourseIds, setAssignedCourseIds] = useState<string[]>([]);
  const [joinedAt, setJoinedAt] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setFullName(initial.fullName);
      setEmail(initial.email);
      setPhone(initial.phone);
      setQualification(initial.qualification);
      setSpecialization(initial.specialization);
      setAssignedCourseIds(initial.assignedCourseIds || []);
      setJoinedAt(initial.joinedAt);
      setStatus(initial.status);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setQualification('BS Computer Science');
      setSpecialization('');
      setAssignedCourseIds([]);
      setJoinedAt(new Date().toISOString().slice(0, 10));
      setStatus('active');
    }
  }, [open, initial]);

  const toggleCourse = (courseId: string) => {
    setAssignedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !isValidEmailFormat(email)) {
      setError('Please enter a full name and a valid Google email address.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: initial?.id || makeSafeId('tch'),
          fullName: fullName.trim(),
          email: normalizeEmail(email),
          phone: phone.trim(),
          qualification: qualification.trim(),
          specialization: specialization.trim(),
          assignedCourseIds,
          status,
          joinedAt: joinedAt.trim() || new Date().toISOString().slice(0, 10),
        },
        Boolean(initial),
        initial?.email
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save teacher.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Edit Teacher · ${initial.fullName}` : 'Add Faculty Teacher'}
      subtitle="Adding a teacher automatically authorizes their Google email for the Teacher Portal."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sir Kamran Ali"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Login Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@gmail.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0300-1234567"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Date</label>
            <input
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="active">Active (Login Enabled)</option>
              <option value="inactive">Inactive (Login Suspended)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qualification</label>
            <input
              type="text"
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="MS Computer Science"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Specialization</label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Full-Stack Web & AI"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Assign Diploma Courses
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/70">
            {courses.map((course) => {
              const checked = assignedCourseIds.includes(course.id);
              return (
                <label
                  key={course.id}
                  className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCourse(course.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                  />
                  <span className="truncate">
                    <span className="font-mono text-xs text-slate-500 mr-1.5">{course.code}</span>
                    {course.title}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : initial ? 'Update Teacher' : 'Add Teacher & Enable Login'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Student Modal
// -----------------------------------------------------------------------------
interface StudentModalProps {
  open: boolean;
  initial: StudentRecord | null;
  courses: CourseRecord[];
  parents: ParentRecord[];
  nextRollNumber: string;
  onClose: () => void;
  onSave: (
    data: Omit<StudentRecord, 'createdAt' | 'updatedAt'>,
    isEdit: boolean,
    previousEmail?: string
  ) => Promise<void>;
}

export function StudentModal({
  open,
  initial,
  courses,
  parents,
  nextRollNumber,
  onClose,
  onSave,
}: StudentModalProps) {
  const [rollNumber, setRollNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [batch, setBatch] = useState('Morning Shift');
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [monthlyFee, setMonthlyFee] = useState(5500);
  const [feeStatus, setFeeStatus] = useState<'paid' | 'pending' | 'partial'>('pending');
  const [admissionDate, setAdmissionDate] = useState('');
  const [status, setStatus] = useState<'active' | 'graduated' | 'suspended'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setRollNumber(initial.rollNumber);
      setFullName(initial.fullName);
      setEmail(initial.email);
      setPhone(initial.phone);
      setCourseIds(initial.courseIds || []);
      setBatch(initial.batch);
      setParentEmail(initial.parentEmail || '');
      setParentName(initial.parentName || '');
      setMonthlyFee(initial.monthlyFee);
      setFeeStatus(initial.feeStatus);
      setAdmissionDate(initial.admissionDate);
      setStatus(initial.status);
    } else {
      setRollNumber(nextRollNumber);
      setFullName('');
      setEmail('');
      setPhone('');
      const firstCourse = courses[0];
      setCourseIds(firstCourse ? [firstCourse.id] : []);
      setBatch('Morning Shift');
      setParentEmail('');
      setParentName('');
      setMonthlyFee(firstCourse ? firstCourse.feeMonthly : 5000);
      setFeeStatus('pending');
      setAdmissionDate(new Date().toISOString().slice(0, 10));
      setStatus('active');
    }
  }, [open, initial, courses, nextRollNumber]);

  const toggleCourse = (course: CourseRecord) => {
    setCourseIds((prev) => {
      const next = prev.includes(course.id)
        ? prev.filter((id) => id !== course.id)
        : [...prev, course.id];
      if (!initial && next.length > 0) {
        const totalFee = courses
          .filter((c) => next.includes(c.id))
          .reduce((acc, c) => acc + c.feeMonthly, 0);
        setMonthlyFee(totalFee);
      }
      return next;
    });
  };

  const handleParentSelect = (selectedEmail: string) => {
    setParentEmail(selectedEmail);
    const found = parents.find((p) => p.email === selectedEmail);
    if (found) {
      setParentName(found.fullName);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !rollNumber.trim() || !isValidEmailFormat(email)) {
      setError('Roll number, full name, and a valid Google email address are required.');
      return;
    }
    if (courseIds.length === 0) {
      setError('Select at least one diploma course for enrollment.');
      return;
    }
    if (parentEmail.trim() && !isValidEmailFormat(parentEmail)) {
      setError('Parent email must be a valid email address or left blank.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: initial?.id || makeSafeId('stu'),
          rollNumber: rollNumber.trim(),
          fullName: fullName.trim(),
          email: normalizeEmail(email),
          phone: phone.trim(),
          courseIds,
          primaryCourseId: courseIds[0],
          batch: batch.trim() || 'Morning Shift',
          parentEmail: parentEmail.trim() ? normalizeEmail(parentEmail) : '',
          parentName: parentName.trim(),
          feeStatus,
          monthlyFee: Number(monthlyFee) || 0,
          admissionDate: admissionDate || new Date().toISOString().slice(0, 10),
          status,
        },
        Boolean(initial),
        initial?.email
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Edit Student · ${initial.fullName}` : 'Enroll New Student'}
      subtitle="Grants Student Portal Google login access and links enrolled diploma tracks."
      onClose={onClose}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Number</label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ayesha Siddiqui"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student Google Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@gmail.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0321-7654321"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Enrolled Diploma Course(s)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/70">
            {courses.map((course) => {
              const checked = courseIds.includes(course.id);
              return (
                <label
                  key={course.id}
                  className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCourse(course)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                  />
                  <span className="truncate">
                    <span className="font-mono text-xs text-slate-500 mr-1.5">{course.code}</span>
                    {course.title}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Batch / Shift</label>
            <input
              type="text"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monthly Fee (PKR)
            </label>
            <input
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Status</label>
            <select
              value={feeStatus}
              onChange={(e) => setFeeStatus(e.target.value as 'paid' | 'pending' | 'partial')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'graduated' | 'suspended')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
          {parents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quick Link Existing Parent
              </label>
              <select
                value={parents.some((p) => p.email === parentEmail) ? parentEmail : ''}
                onChange={(e) => handleParentSelect(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
              >
                <option value="">Select Parent...</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.email}>
                    {p.fullName} ({p.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent / Guardian Name
            </label>
            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent Google Email
            </label>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@gmail.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : initial ? 'Update Student' : 'Enroll Student & Enable Login'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Parent Modal
// -----------------------------------------------------------------------------
interface ParentModalProps {
  open: boolean;
  initial: ParentRecord | null;
  students: StudentRecord[];
  onClose: () => void;
  onSave: (
    data: Omit<ParentRecord, 'createdAt' | 'updatedAt'>,
    isEdit: boolean,
    previousEmail?: string
  ) => Promise<void>;
}

export function ParentModal({ open, initial, students, onClose, onSave }: ParentModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Father');
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setFullName(initial.fullName);
      setEmail(initial.email);
      setPhone(initial.phone);
      setRelationship(initial.relationship);
      setLinkedStudentIds(initial.linkedStudentIds || []);
      setStatus(initial.status);
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setRelationship('Father');
      setLinkedStudentIds([]);
      setStatus('active');
    }
  }, [open, initial]);

  const toggleStudent = (studentId: string) => {
    setLinkedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !isValidEmailFormat(email)) {
      setError('Full name and a valid Google email address are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const linkedEmails = students
        .filter((s) => linkedStudentIds.includes(s.id))
        .map((s) => s.email);

      await onSave(
        {
          id: initial?.id || makeSafeId('par'),
          fullName: fullName.trim(),
          email: normalizeEmail(email),
          phone: phone.trim(),
          relationship: relationship.trim() || 'Guardian',
          linkedStudentIds,
          linkedStudentEmails: linkedEmails,
          status,
        },
        Boolean(initial),
        initial?.email
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save parent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Edit Parent · ${initial.fullName}` : 'Add Parent / Guardian'}
      subtitle="Grants Parent Portal Google login access and links student progress records."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parent / Guardian Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Tariq Mahmood"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Login Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@gmail.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0301-9876543"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Guardian">Guardian</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Portal Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="active">Active (Login Enabled)</option>
              <option value="inactive">Inactive (Login Suspended)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Link Child / Student(s)
          </label>
          {students.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              No students enrolled yet. Enroll students first, or link them later.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 p-3 bg-slate-50/70">
              {students.map((student) => {
                const checked = linkedStudentIds.includes(student.id);
                return (
                  <label
                    key={student.id}
                    className="flex items-center justify-between gap-2 text-sm text-slate-800 cursor-pointer py-1"
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                      />
                      <span className="font-mono text-xs text-slate-500">{student.rollNumber}</span>
                      <span className="truncate">{student.fullName}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-400 truncate max-w-[180px]">
                      {student.email}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : initial ? 'Update Parent' : 'Add Parent & Enable Login'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Grade Modal (Shared by Admin & Teacher)
// -----------------------------------------------------------------------------
interface GradeModalProps {
  open: boolean;
  initial: GradeRecord | null;
  enrollments: EnrollmentRecord[];
  gradedBy: string;
  onClose: () => void;
  onSave: (
    payload: {
      id?: string;
      enrollment: EnrollmentRecord;
      assessmentTitle: string;
      score: number;
      maxScore: number;
      remarks: string;
      gradedDate: string;
      gradedBy: string;
    },
    isEdit: boolean
  ) => Promise<void>;
}

export function GradeModal({
  open,
  initial,
  enrollments,
  gradedBy,
  onClose,
  onSave,
}: GradeModalProps) {
  const [enrollmentId, setEnrollmentId] = useState('');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [score, setScore] = useState(85);
  const [maxScore, setMaxScore] = useState(100);
  const [gradedDate, setGradedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      const matching = enrollments.find(
        (e) => e.studentId === initial.studentId && e.courseId === initial.courseId
      );
      setEnrollmentId(matching?.id || '');
      setAssessmentTitle(initial.assessmentTitle);
      setScore(initial.score);
      setMaxScore(initial.maxScore);
      setGradedDate(initial.gradedDate);
      setRemarks(initial.remarks);
    } else {
      setEnrollmentId(enrollments[0]?.id || '');
      setAssessmentTitle('');
      setScore(85);
      setMaxScore(100);
      setGradedDate(new Date().toISOString().slice(0, 10));
      setRemarks('');
    }
  }, [open, initial, enrollments]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const selected =
      enrollments.find((enr) => enr.id === enrollmentId) ||
      (initial
        ? ({
            id: 'existing',
            studentId: initial.studentId,
            studentName: initial.studentName,
            studentRollNumber: initial.studentRollNumber,
            studentEmail: initial.studentEmail,
            courseId: initial.courseId,
            courseTitle: initial.courseTitle,
            teacherEmail: initial.teacherEmail,
            parentEmail: initial.parentEmail,
            batch: '',
            status: 'active',
          } as EnrollmentRecord)
        : undefined);

    if (!selected) {
      setError('Please select an enrolled student.');
      return;
    }
    if (!assessmentTitle.trim()) {
      setError('Assessment title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: initial?.id,
          enrollment: selected,
          assessmentTitle: assessmentTitle.trim(),
          score: Number(score) || 0,
          maxScore: Math.max(1, Number(maxScore) || 100),
          remarks: remarks.trim(),
          gradedDate: gradedDate || new Date().toISOString().slice(0, 10),
          gradedBy,
        },
        Boolean(initial)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save grade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Edit Grade · ${initial.studentName}` : 'Record Assessment Grade'}
      subtitle={`Calculated Grade: ${computeLetterGrade(score, maxScore)}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        {!initial && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student &amp; Course
            </label>
            <select
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              {enrollments.map((enr) => (
                <option key={enr.id} value={enr.id}>
                  {enr.studentRollNumber} · {enr.studentName} — {enr.courseTitle}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Assessment / Exam Title
          </label>
          <input
            type="text"
            required
            value={assessmentTitle}
            onChange={(e) => setAssessmentTitle(e.target.value)}
            placeholder="e.g. Module 2 Practical Exam"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Score</label>
            <input
              type="number"
              min={0}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Max Score</label>
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={gradedDate}
              onChange={(e) => setGradedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Instructor Remarks
          </label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Feedback for student and parent..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Grade'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Fee Voucher Modal
// -----------------------------------------------------------------------------
interface FeeModalProps {
  open: boolean;
  initial: FeeRecord | null;
  defaultStudentId?: string;
  students: StudentRecord[];
  courses: CourseRecord[];
  onClose: () => void;
  onSave: (data: Omit<FeeRecord, 'createdAt' | 'updatedAt'>, isEdit: boolean) => Promise<void>;
}

export function FeeModal({
  open,
  initial,
  defaultStudentId,
  students,
  courses,
  onClose,
  onSave,
}: FeeModalProps) {
  const [studentId, setStudentId] = useState('');
  const [monthLabel, setMonthLabel] = useState('November 2026');
  const [amount, setAmount] = useState(5000);
  const [paidAmount, setPaidAmount] = useState(0);
  const [status, setStatus] = useState<'paid' | 'pending' | 'partial'>('pending');
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setStudentId(initial.studentId);
      setMonthLabel(initial.monthLabel);
      setAmount(initial.amount);
      setPaidAmount(initial.paidAmount);
      setStatus(initial.status);
      setDueDate(initial.dueDate);
      setPaidDate(initial.paidDate);
      setReceiptNo(initial.receiptNo);
      setNotes(initial.notes);
    } else {
      const firstStu =
        (defaultStudentId && students.find((s) => s.id === defaultStudentId)) || students[0];
      setStudentId(firstStu?.id || '');
      setMonthLabel('November 2026');
      setAmount(firstStu?.monthlyFee || 5000);
      setPaidAmount(0);
      setStatus('pending');
      setDueDate(new Date().toISOString().slice(0, 10));
      setPaidDate('');
      setReceiptNo(`LNI-${Math.floor(10000 + Math.random() * 90000)}`);
      setNotes('');
    }
  }, [open, initial, defaultStudentId, students]);

  const handleStudentChange = (nextId: string) => {
    setStudentId(nextId);
    const stu = students.find((s) => s.id === nextId);
    if (stu) {
      setAmount(stu.monthlyFee);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === studentId);
    if (!stu && !initial) {
      setError('Select a student to create a fee record.');
      return;
    }
    const course = courses.find((c) => c.id === (stu?.primaryCourseId || initial?.courseId));
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: initial?.id || makeSafeId('fee'),
          studentId: stu?.id || initial!.studentId,
          studentName: stu?.fullName || initial!.studentName,
          studentRollNumber: stu?.rollNumber || initial!.studentRollNumber,
          studentEmail: stu?.email || initial!.studentEmail,
          parentEmail: stu?.parentEmail || initial!.parentEmail,
          courseId: course?.id || stu?.primaryCourseId || initial!.courseId || 'office-management',
          courseTitle: course?.title || initial?.courseTitle || 'Diploma Program',
          monthLabel: monthLabel.trim(),
          amount: Number(amount) || 0,
          paidAmount: Number(paidAmount) || 0,
          status,
          dueDate,
          paidDate: status === 'paid' && !paidDate ? new Date().toISOString().slice(0, 10) : paidDate,
          receiptNo: receiptNo.trim(),
          notes: notes.trim(),
        },
        Boolean(initial)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save fee record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? `Update Fee · ${initial.studentName}` : 'Create Fee Voucher'}
      subtitle="Visible in real time to the student and linked parent portal."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        {!initial && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Student</label>
            <select
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNumber} · {s.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Month</label>
            <input
              type="text"
              required
              value={monthLabel}
              onChange={(e) => setMonthLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt No.</label>
            <input
              type="text"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Fee (PKR)
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Paid Amount (PKR)
            </label>
            <input
              type="number"
              min={0}
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as 'paid' | 'pending' | 'partial';
                setStatus(next);
                if (next === 'paid') setPaidAmount(amount);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Paid Date</label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional payment reference"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Fee Record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Announcement Modal
// -----------------------------------------------------------------------------
interface AnnouncementModalProps {
  open: boolean;
  initial: AnnouncementRecord | null;
  courses: CourseRecord[];
  authorName: string;
  authorEmail: string;
  authorRole: 'admin' | 'teacher';
  onClose: () => void;
  onSave: (
    data: Omit<AnnouncementRecord, 'createdAt' | 'updatedAt'>,
    isEdit: boolean
  ) => Promise<void>;
}

export function AnnouncementModal({
  open,
  initial,
  courses,
  authorName,
  authorEmail,
  authorRole,
  onClose,
  onSave,
}: AnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'teacher' | 'student' | 'parent'>('all');
  const [courseId, setCourseId] = useState('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setTitle(initial.title);
      setBody(initial.body);
      setTargetRole(initial.targetRole);
      setCourseId(initial.courseId || 'all');
    } else {
      setTitle('');
      setBody('');
      setTargetRole('all');
      setCourseId('all');
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and message body are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const selectedCourse = courses.find((c) => c.id === courseId);
      await onSave(
        {
          id: initial?.id || makeSafeId('ann'),
          title: title.trim(),
          body: body.trim(),
          targetRole,
          courseId,
          courseTitle: selectedCourse ? selectedCourse.title : 'All Courses',
          authorName,
          authorEmail,
          authorRole,
        },
        Boolean(initial)
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post announcement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? 'Edit Announcement' : 'Post Institute Announcement'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Midterm Practical Schedule"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audience</label>
            <select
              value={targetRole}
              onChange={(e) =>
                setTargetRole(e.target.value as 'all' | 'teacher' | 'student' | 'parent')
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Portals</option>
              <option value="student">Students Only</option>
              <option value="parent">Parents Only</option>
              {authorRole === 'admin' && <option value="teacher">Teachers Only</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Course Scope</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
          <textarea
            rows={4}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write details clearly for recipients..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? 'Posting...' : initial ? 'Update Notice' : 'Publish Notice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
