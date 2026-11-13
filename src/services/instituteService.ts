import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_DIPLOMA_COURSES } from '../data/defaultCourses';
import { ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ActivityCategory,
  AnnouncementRecord,
  AttendanceRecord,
  CourseRecord,
  EnrollmentRecord,
  FeeRecord,
  GradeRecord,
  InviteRecord,
  ParentRecord,
  PortalRole,
  StudentRecord,
  TeacherRecord,
  UserRole,
} from '../types/institute';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 128);
}

export function isValidEmailFormat(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function clamp(val: string, max: number): string {
  return val.trim().slice(0, max);
}

export function computeLetterGrade(score: number, maxScore: number): string {
  if (maxScore <= 0) return 'N/A';
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

export async function fetchUserInvite(email: string): Promise<InviteRecord | null> {
  const cleanEmail = normalizeEmail(email);
  const path = `invites/${cleanEmail}`;
  try {
    const snap = await getDoc(doc(db, 'invites', cleanEmail));
    if (!snap.exists()) return null;
    return snap.data() as InviteRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function seedDefaultCoursesIfEmpty(): Promise<boolean> {
  const path = 'courses';
  try {
    const existingSnap = await getDocs(collection(db, 'courses'));
    if (!existingSnap.empty) return false;

    const batch = writeBatch(db);
    for (const course of DEFAULT_DIPLOMA_COURSES) {
      const ref = doc(db, 'courses', course.id);
      batch.set(ref, {
        ...course,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function restoreMissingDefaultCourses(): Promise<number> {
  const path = 'courses';
  try {
    const existingSnap = await getDocs(collection(db, 'courses'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const missing = DEFAULT_DIPLOMA_COURSES.filter((c) => !existingIds.has(c.id));
    if (missing.length === 0) return 0;

    const batch = writeBatch(db);
    for (const course of missing) {
      batch.set(doc(db, 'courses', course.id), {
        ...course,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return missing.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCourse(
  input: Omit<CourseRecord, 'createdAt' | 'updatedAt'>,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('course'));
  const path = `courses/${id}`;
  const cleanModules = input.modules
    .map((m) => clamp(m, 160))
    .filter(Boolean)
    .slice(0, 20);

  const payload = {
    code: clamp(input.code, 24),
    title: clamp(input.title, 120),
    description: clamp(input.description, 1000),
    durationMonths: Math.max(1, Math.min(60, Number(input.durationMonths) || 6)),
    feeMonthly: Math.max(0, Math.min(1000000, Number(input.feeMonthly) || 0)),
    schedule: clamp(input.schedule, 120),
    teacherId: clamp(input.teacherId, 128),
    teacherName: clamp(input.teacherName || 'Unassigned', 120),
    teacherEmail: normalizeEmail(input.teacherEmail || ''),
    modules: cleanModules,
    imageKey: clamp(input.imageKey || 'office-management', 64),
    status: input.status,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'courses', id), payload);
      // Sync teacherEmail to enrollments for this course
      const enrollSnap = await getDocs(
        query(collection(db, 'enrollments'), where('courseId', '==', id))
      );
      if (!enrollSnap.empty) {
        const batch = writeBatch(db);
        enrollSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            courseTitle: payload.title,
            teacherEmail: payload.teacherEmail,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } else {
      await setDoc(doc(db, 'courses', id), {
        id,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function upsertInvite(params: {
  email: string;
  role: PortalRole;
  displayName: string;
  linkedRecordId: string;
  status: 'active' | 'suspended';
  previousEmail?: string;
}) {
  const cleanEmail = normalizeEmail(params.email);
  const path = `invites/${cleanEmail}`;
  try {
    if (params.previousEmail && normalizeEmail(params.previousEmail) !== cleanEmail) {
      await deleteDoc(doc(db, 'invites', normalizeEmail(params.previousEmail)));
    }
    const existing = await getDoc(doc(db, 'invites', cleanEmail));
    if (existing.exists()) {
      await updateDoc(doc(db, 'invites', cleanEmail), {
        role: params.role,
        displayName: clamp(params.displayName, 120),
        linkedRecordId: sanitizeId(params.linkedRecordId),
        status: params.status,
        addedBy: ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'invites', cleanEmail), {
        email: cleanEmail,
        role: params.role,
        displayName: clamp(params.displayName, 120),
        linkedRecordId: sanitizeId(params.linkedRecordId),
        status: params.status,
        addedBy: ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleInviteStatus(
  email: string,
  nextStatus: 'active' | 'suspended'
): Promise<void> {
  const cleanEmail = normalizeEmail(email);
  const path = `invites/${cleanEmail}`;
  try {
    await updateDoc(doc(db, 'invites', cleanEmail), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveTeacherWithInvite(
  input: Omit<TeacherRecord, 'createdAt' | 'updatedAt'>,
  allCourses: CourseRecord[],
  isEdit: boolean,
  previousEmail?: string
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('tch'));
  const cleanEmail = normalizeEmail(input.email);
  const path = `teachers/${id}`;

  const payload = {
    fullName: clamp(input.fullName, 120),
    email: cleanEmail,
    phone: clamp(input.phone, 32),
    qualification: clamp(input.qualification, 160),
    specialization: clamp(input.specialization, 160),
    assignedCourseIds: input.assignedCourseIds.slice(0, 15),
    status: input.status,
    joinedAt: clamp(input.joinedAt, 32),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'teachers', id), payload);
    } else {
      await setDoc(doc(db, 'teachers', id), {
        id,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    await upsertInvite({
      email: cleanEmail,
      role: 'teacher',
      displayName: payload.fullName,
      linkedRecordId: id,
      status: input.status === 'active' ? 'active' : 'suspended',
      previousEmail,
    });

    // Update assigned courses and enrollments
    const batch = writeBatch(db);
    let hasCourseUpdates = false;
    for (const course of allCourses) {
      const shouldBeAssigned = payload.assignedCourseIds.includes(course.id);
      const wasAssignedToThisTeacher = course.teacherId === id;

      if (shouldBeAssigned) {
        batch.update(doc(db, 'courses', course.id), {
          teacherId: id,
          teacherName: payload.fullName,
          teacherEmail: cleanEmail,
          updatedAt: serverTimestamp(),
        });
        hasCourseUpdates = true;
      } else if (wasAssignedToThisTeacher) {
        batch.update(doc(db, 'courses', course.id), {
          teacherId: '',
          teacherName: 'Unassigned',
          teacherEmail: '',
          updatedAt: serverTimestamp(),
        });
        hasCourseUpdates = true;
      }
    }
    if (hasCourseUpdates) {
      await batch.commit();
    }

    // Sync teacherEmail on enrollments for newly assigned courses
    for (const courseId of payload.assignedCourseIds) {
      const enrollSnap = await getDocs(
        query(collection(db, 'enrollments'), where('courseId', '==', courseId))
      );
      if (!enrollSnap.empty) {
        const enrollBatch = writeBatch(db);
        enrollSnap.docs.forEach((d) => {
          enrollBatch.update(d.ref, {
            teacherEmail: cleanEmail,
            updatedAt: serverTimestamp(),
          });
        });
        await enrollBatch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteTeacherWithInvite(teacher: TeacherRecord): Promise<void> {
  const path = `teachers/${teacher.id}`;
  try {
    await deleteDoc(doc(db, 'teachers', teacher.id));
    if (teacher.email) {
      await deleteDoc(doc(db, 'invites', normalizeEmail(teacher.email)));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveStudentWithInvite(
  input: Omit<StudentRecord, 'createdAt' | 'updatedAt'>,
  allCourses: CourseRecord[],
  isEdit: boolean,
  previousEmail?: string
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('stu'));
  const cleanEmail = normalizeEmail(input.email);
  const cleanParentEmail = input.parentEmail ? normalizeEmail(input.parentEmail) : '';
  const path = `students/${id}`;
  const courseIds = input.courseIds.slice(0, 10);
  const primaryCourseId = input.primaryCourseId || courseIds[0] || '';

  const payload = {
    rollNumber: clamp(input.rollNumber, 32),
    fullName: clamp(input.fullName, 120),
    email: cleanEmail,
    phone: clamp(input.phone, 32),
    courseIds,
    primaryCourseId,
    batch: clamp(input.batch, 64),
    parentEmail: cleanParentEmail,
    parentName: clamp(input.parentName, 120),
    feeStatus: input.feeStatus,
    monthlyFee: Math.max(0, Math.min(1000000, Number(input.monthlyFee) || 0)),
    admissionDate: clamp(input.admissionDate, 32),
    status: input.status,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'students', id), payload);
    } else {
      await setDoc(doc(db, 'students', id), {
        id,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    await upsertInvite({
      email: cleanEmail,
      role: 'student',
      displayName: payload.fullName,
      linkedRecordId: id,
      status: input.status === 'suspended' ? 'suspended' : 'active',
      previousEmail,
    });

    // Reconcile enrollments for this student
    const existingEnrollSnap = await getDocs(
      query(collection(db, 'enrollments'), where('studentId', '==', id))
    );
    const existingByCourse = new Map<string, string>();
    existingEnrollSnap.docs.forEach((d) => {
      const data = d.data() as EnrollmentRecord;
      existingByCourse.set(data.courseId, d.id);
    });

    const batch = writeBatch(db);
    // Delete enrollments for removed courses
    for (const [courseId, enrollId] of existingByCourse.entries()) {
      if (!courseIds.includes(courseId)) {
        batch.delete(doc(db, 'enrollments', enrollId));
      }
    }

    // Create/update enrollments for selected courses
    for (const courseId of courseIds) {
      const course = allCourses.find((c) => c.id === courseId);
      if (!course) continue;
      const enrollId = sanitizeId(`enr_${id}_${courseId}`);
      const existingDocId = existingByCourse.get(courseId);
      if (existingDocId) {
        batch.update(doc(db, 'enrollments', existingDocId), {
          studentName: payload.fullName,
          studentRollNumber: payload.rollNumber,
          studentEmail: cleanEmail,
          courseTitle: course.title,
          teacherEmail: normalizeEmail(course.teacherEmail || ''),
          parentEmail: cleanParentEmail,
          batch: payload.batch,
          status: input.status === 'graduated' ? 'completed' : 'active',
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'enrollments', enrollId), {
          id: enrollId,
          studentId: id,
          studentName: payload.fullName,
          studentRollNumber: payload.rollNumber,
          studentEmail: cleanEmail,
          courseId: course.id,
          courseTitle: course.title,
          teacherEmail: normalizeEmail(course.teacherEmail || ''),
          parentEmail: cleanParentEmail,
          batch: payload.batch,
          status: input.status === 'graduated' ? 'completed' : 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteStudentWithInvite(student: StudentRecord): Promise<void> {
  const path = `students/${student.id}`;
  try {
    await deleteDoc(doc(db, 'students', student.id));
    if (student.email) {
      await deleteDoc(doc(db, 'invites', normalizeEmail(student.email)));
    }
    const enrollSnap = await getDocs(
      query(collection(db, 'enrollments'), where('studentId', '==', student.id))
    );
    if (!enrollSnap.empty) {
      const batch = writeBatch(db);
      enrollSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveParentWithInvite(
  input: Omit<ParentRecord, 'createdAt' | 'updatedAt'>,
  allStudents: StudentRecord[],
  isEdit: boolean,
  previousEmail?: string
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('par'));
  const cleanEmail = normalizeEmail(input.email);
  const path = `parents/${id}`;

  const linkedStudents = allStudents.filter((s) => input.linkedStudentIds.includes(s.id));
  const linkedStudentIds = linkedStudents.map((s) => s.id).slice(0, 10);
  const linkedStudentEmails = linkedStudents.map((s) => normalizeEmail(s.email)).slice(0, 10);

  const payload = {
    fullName: clamp(input.fullName, 120),
    email: cleanEmail,
    phone: clamp(input.phone, 32),
    relationship: clamp(input.relationship || 'Guardian', 48),
    linkedStudentIds,
    linkedStudentEmails,
    status: input.status,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'parents', id), payload);
    } else {
      await setDoc(doc(db, 'parents', id), {
        id,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    await upsertInvite({
      email: cleanEmail,
      role: 'parent',
      displayName: payload.fullName,
      linkedRecordId: id,
      status: input.status === 'active' ? 'active' : 'suspended',
      previousEmail,
    });

    // Update linked students & their enrollments with parentEmail and parentName
    for (const student of linkedStudents) {
      await updateDoc(doc(db, 'students', student.id), {
        parentEmail: cleanEmail,
        parentName: payload.fullName,
        updatedAt: serverTimestamp(),
      });

      const enrollSnap = await getDocs(
        query(collection(db, 'enrollments'), where('studentId', '==', student.id))
      );
      if (!enrollSnap.empty) {
        const batch = writeBatch(db);
        enrollSnap.docs.forEach((d) => {
          batch.update(d.ref, {
            parentEmail: cleanEmail,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteParentWithInvite(parent: ParentRecord): Promise<void> {
  const path = `parents/${parent.id}`;
  try {
    await deleteDoc(doc(db, 'parents', parent.id));
    if (parent.email) {
      await deleteDoc(doc(db, 'invites', normalizeEmail(parent.email)));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function markAttendanceRecord(params: {
  date: string;
  enrollment: EnrollmentRecord;
  status: 'present' | 'absent' | 'late';
  remarks: string;
  markedBy: string;
}): Promise<void> {
  const id = sanitizeId(`att_${params.date}_${params.enrollment.courseId}_${params.enrollment.studentId}`);
  const path = `attendance/${id}`;
  try {
    const existing = await getDoc(doc(db, 'attendance', id));
    if (existing.exists()) {
      await updateDoc(doc(db, 'attendance', id), {
        status: params.status,
        remarks: clamp(params.remarks, 300),
        markedBy: normalizeEmail(params.markedBy),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'attendance', id), {
        id,
        date: clamp(params.date, 16),
        courseId: params.enrollment.courseId,
        courseTitle: clamp(params.enrollment.courseTitle, 120),
        studentId: params.enrollment.studentId,
        studentName: clamp(params.enrollment.studentName, 120),
        studentRollNumber: clamp(params.enrollment.studentRollNumber, 32),
        studentEmail: normalizeEmail(params.enrollment.studentEmail),
        parentEmail: normalizeEmail(params.enrollment.parentEmail || ''),
        teacherEmail: normalizeEmail(params.enrollment.teacherEmail || ''),
        status: params.status,
        remarks: clamp(params.remarks, 300),
        markedBy: normalizeEmail(params.markedBy),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markBatchAttendanceRecords(params: {
  date: string;
  entries: Array<{
    enrollment: EnrollmentRecord;
    status: 'present' | 'absent' | 'late';
    remarks: string;
  }>;
  markedBy: string;
}): Promise<number> {
  if (params.entries.length === 0) return 0;

  const cleanDate = clamp(params.date, 16);
  const cleanMarkedBy = normalizeEmail(params.markedBy);
  const path = 'attendance';

  try {
    const refs = params.entries.map((entry) => {
      const id = sanitizeId(
        `att_${cleanDate}_${entry.enrollment.courseId}_${entry.enrollment.studentId}`
      );
      return { id, entry, ref: doc(db, 'attendance', id) };
    });

    const snapshots = await Promise.all(refs.map((item) => getDoc(item.ref)));
    const batch = writeBatch(db);

    refs.forEach((item, index) => {
      const { id, entry, ref } = item;
      const existing = snapshots[index];
      const cleanRemarks = clamp(entry.remarks, 300);

      if (existing.exists()) {
        batch.update(ref, {
          status: entry.status,
          remarks: cleanRemarks,
          markedBy: cleanMarkedBy,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(ref, {
          id,
          date: cleanDate,
          courseId: entry.enrollment.courseId,
          courseTitle: clamp(entry.enrollment.courseTitle, 120),
          studentId: entry.enrollment.studentId,
          studentName: clamp(entry.enrollment.studentName, 120),
          studentRollNumber: clamp(entry.enrollment.studentRollNumber, 32),
          studentEmail: normalizeEmail(entry.enrollment.studentEmail),
          parentEmail: normalizeEmail(entry.enrollment.parentEmail || ''),
          teacherEmail: normalizeEmail(entry.enrollment.teacherEmail || cleanMarkedBy),
          status: entry.status,
          remarks: cleanRemarks,
          markedBy: cleanMarkedBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    return refs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveGradeRecord(
  input: {
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
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('grd'));
  const path = `grades/${id}`;
  const score = Math.max(0, Math.min(10000, Number(input.score) || 0));
  const maxScore = Math.max(1, Math.min(10000, Number(input.maxScore) || 100));
  const gradeLetter = computeLetterGrade(score, maxScore);

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'grades', id), {
        assessmentTitle: clamp(input.assessmentTitle, 120),
        score,
        maxScore,
        gradeLetter,
        remarks: clamp(input.remarks, 400),
        gradedDate: clamp(input.gradedDate, 16),
        gradedBy: normalizeEmail(input.gradedBy),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'grades', id), {
        id,
        studentId: input.enrollment.studentId,
        studentName: clamp(input.enrollment.studentName, 120),
        studentRollNumber: clamp(input.enrollment.studentRollNumber, 32),
        studentEmail: normalizeEmail(input.enrollment.studentEmail),
        parentEmail: normalizeEmail(input.enrollment.parentEmail || ''),
        courseId: input.enrollment.courseId,
        courseTitle: clamp(input.enrollment.courseTitle, 120),
        teacherEmail: normalizeEmail(input.enrollment.teacherEmail || ''),
        assessmentTitle: clamp(input.assessmentTitle, 120),
        score,
        maxScore,
        gradeLetter,
        remarks: clamp(input.remarks, 400),
        gradedDate: clamp(input.gradedDate, 16),
        gradedBy: normalizeEmail(input.gradedBy),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteGradeRecord(gradeId: string): Promise<void> {
  const path = `grades/${gradeId}`;
  try {
    await deleteDoc(doc(db, 'grades', gradeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveFeeRecord(
  input: Omit<FeeRecord, 'createdAt' | 'updatedAt'>,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('fee'));
  const path = `fees/${id}`;
  const amount = Math.max(0, Math.min(1000000, Number(input.amount) || 0));
  const paidAmount = Math.max(0, Math.min(1000000, Number(input.paidAmount) || 0));

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'fees', id), {
        monthLabel: clamp(input.monthLabel, 48),
        amount,
        paidAmount,
        status: input.status,
        dueDate: clamp(input.dueDate, 16),
        paidDate: clamp(input.paidDate, 16),
        receiptNo: clamp(input.receiptNo, 48),
        notes: clamp(input.notes, 300),
        parentEmail: normalizeEmail(input.parentEmail || ''),
        studentEmail: normalizeEmail(input.studentEmail),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'fees', id), {
        id,
        studentId: sanitizeId(input.studentId),
        studentName: clamp(input.studentName, 120),
        studentRollNumber: clamp(input.studentRollNumber, 32),
        studentEmail: normalizeEmail(input.studentEmail),
        parentEmail: normalizeEmail(input.parentEmail || ''),
        courseId: sanitizeId(input.courseId),
        courseTitle: clamp(input.courseTitle, 120),
        monthLabel: clamp(input.monthLabel, 48),
        amount,
        paidAmount,
        status: input.status,
        dueDate: clamp(input.dueDate, 16),
        paidDate: clamp(input.paidDate, 16),
        receiptNo: clamp(input.receiptNo, 48),
        notes: clamp(input.notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteFeeRecord(feeId: string): Promise<void> {
  const path = `fees/${feeId}`;
  try {
    await deleteDoc(doc(db, 'fees', feeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordFeePayment(params: {
  fee: FeeRecord;
  paymentAmount: number;
  paidDate: string;
  notes: string;
}): Promise<{ newPaidAmount: number; nextStatus: 'paid' | 'partial' | 'pending' }> {
  const path = `fees/${params.fee.id}`;
  const addAmount = Math.max(0, Number(params.paymentAmount) || 0);
  const newPaidAmount = Math.min(params.fee.amount, Math.max(0, params.fee.paidAmount + addAmount));
  const nextStatus: 'paid' | 'partial' | 'pending' =
    newPaidAmount >= params.fee.amount && params.fee.amount > 0
      ? 'paid'
      : newPaidAmount > 0
      ? 'partial'
      : 'pending';

  const cleanPaidDate = clamp(params.paidDate || new Date().toISOString().slice(0, 10), 16);
  const cleanNotes = clamp(params.notes, 300);

  try {
    await updateDoc(doc(db, 'fees', params.fee.id), {
      paidAmount: newPaidAmount,
      status: nextStatus,
      paidDate: cleanPaidDate,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
    });

    // Sync student overall feeStatus based on their fee vouchers
    if (params.fee.studentId) {
      const stuRef = doc(db, 'students', params.fee.studentId);
      const stuSnap = await getDoc(stuRef);
      if (stuSnap.exists()) {
        const feeSnap = await getDocs(
          query(collection(db, 'fees'), where('studentId', '==', params.fee.studentId))
        );
        const allStudentFees = feeSnap.docs.map((d) => d.data() as FeeRecord);
        const anyPending = allStudentFees.some((f) => f.status === 'pending');
        const anyPartial = allStudentFees.some((f) => f.status === 'partial');
        const overallStatus: 'paid' | 'partial' | 'pending' =
          allStudentFees.length === 0
            ? nextStatus
            : anyPartial
            ? 'partial'
            : anyPending
            ? allStudentFees.some((f) => f.status === 'paid')
              ? 'partial'
              : 'pending'
            : 'paid';

        await updateDoc(stuRef, {
          feeStatus: overallStatus,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { newPaidAmount, nextStatus };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveAnnouncement(
  input: Omit<AnnouncementRecord, 'createdAt' | 'updatedAt'>,
  isEdit: boolean
): Promise<void> {
  const id = sanitizeId(input.id || makeSafeId('ann'));
  const path = `announcements/${id}`;

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'announcements', id), {
        title: clamp(input.title, 140),
        body: clamp(input.body, 2000),
        targetRole: input.targetRole,
        courseId: clamp(input.courseId || 'all', 128),
        courseTitle: clamp(input.courseTitle || 'All Courses', 120),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'announcements', id), {
        id,
        title: clamp(input.title, 140),
        body: clamp(input.body, 2000),
        targetRole: input.targetRole,
        courseId: clamp(input.courseId || 'all', 128),
        courseTitle: clamp(input.courseTitle || 'All Courses', 120),
        authorName: clamp(input.authorName, 120),
        authorEmail: normalizeEmail(input.authorEmail),
        authorRole: input.authorRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const path = `announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logActivity(params: {
  category: ActivityCategory;
  action: string;
  details: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  targetLabel?: string;
}): Promise<void> {
  const cleanEmail = normalizeEmail(params.actorEmail);
  if (!cleanEmail) return;

  const id = makeSafeId('act');
  const path = `activity_logs/${id}`;
  try {
    await setDoc(doc(db, 'activity_logs', id), {
      id,
      category: params.category,
      action: clamp(params.action || 'Activity', 120),
      details: clamp(params.details || '', 500),
      actorName: clamp(params.actorName || cleanEmail, 120),
      actorEmail: cleanEmail,
      actorRole: params.actorRole,
      targetLabel: clamp(params.targetLabel || '', 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteActivityLog(logId: string): Promise<void> {
  const path = `activity_logs/${logId}`;
  try {
    await deleteDoc(doc(db, 'activity_logs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
