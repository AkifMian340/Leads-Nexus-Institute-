import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';
export type PortalRole = 'teacher' | 'student' | 'parent';

export interface InviteRecord {
  email: string;
  role: PortalRole;
  displayName: string;
  linkedRecordId: string;
  status: 'active' | 'suspended';
  addedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  durationMonths: number;
  feeMonthly: number;
  schedule: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  modules: string[];
  imageKey: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TeacherRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  assignedCourseIds: string[];
  status: 'active' | 'inactive';
  joinedAt: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentRecord {
  id: string;
  rollNumber: string;
  fullName: string;
  email: string;
  phone: string;
  courseIds: string[];
  primaryCourseId: string;
  batch: string;
  parentEmail: string;
  parentName: string;
  feeStatus: 'paid' | 'pending' | 'partial';
  monthlyFee: number;
  admissionDate: string;
  status: 'active' | 'graduated' | 'suspended';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ParentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  relationship: string;
  linkedStudentIds: string[];
  linkedStudentEmails: string[];
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  teacherEmail: string;
  parentEmail: string;
  batch: string;
  status: 'active' | 'completed' | 'dropped';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  parentEmail: string;
  teacherEmail: string;
  status: 'present' | 'absent' | 'late';
  remarks: string;
  markedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  parentEmail: string;
  courseId: string;
  courseTitle: string;
  teacherEmail: string;
  assessmentTitle: string;
  score: number;
  maxScore: number;
  gradeLetter: string;
  remarks: string;
  gradedDate: string;
  gradedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  parentEmail: string;
  courseId: string;
  courseTitle: string;
  monthLabel: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'partial';
  dueDate: string;
  paidDate: string;
  receiptNo: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  targetRole: 'all' | 'teacher' | 'student' | 'parent';
  courseId: string;
  courseTitle: string;
  authorName: string;
  authorEmail: string;
  authorRole: 'admin' | 'teacher';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ActivityCategory =
  | 'login'
  | 'course'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'attendance'
  | 'grade'
  | 'fee'
  | 'announcement'
  | 'access';

export interface ActivityLogRecord {
  id: string;
  category: ActivityCategory;
  action: string;
  details: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  targetLabel: string;
  createdAt?: Timestamp;
}
