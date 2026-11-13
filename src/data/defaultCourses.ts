import { CourseRecord } from '../types/institute';

export const HERO_CAMPUS_IMAGE =
  '/src/assets/images/institute_campus_hero_1794585960799.jpg';

export const COURSE_IMAGES: Record<string, string> = {
  'office-management': '/src/assets/images/course_office_management_1794585960851.jpg',
  'graphic-designing': '/src/assets/images/course_graphic_designing_1794585962190.jpg',
  'digital-marketing': '/src/assets/images/course_digital_marketing_1794585962561.jpg',
  'web-development': '/src/assets/images/course_web_development_1794585962885.jpg',
  'ai-tutor': '/src/assets/images/course_ai_tutor_1794585964380.jpg',
};

export type DefaultCourseSeed = Omit<CourseRecord, 'createdAt' | 'updatedAt'>;

export const DEFAULT_DIPLOMA_COURSES: DefaultCourseSeed[] = [
  {
    id: 'office-management',
    code: 'OM-101',
    title: 'Office Management',
    description:
      'Comprehensive diploma covering enterprise document workflows, Excel financial modeling, executive presentations, and office accounting systems.',
    durationMonths: 6,
    feeMonthly: 4500,
    schedule: 'Mon - Fri · 09:00 AM - 11:00 AM',
    teacherId: '',
    teacherName: 'Unassigned',
    teacherEmail: '',
    modules: [
      '01. Microsoft Word & Business Documentation',
      '02. Advanced Excel Formulas, Macros & Pivot Tables',
      '03. PowerPoint Executive Presentations',
      '04. Office Accounting & Ledger Fundamentals',
      '05. Professional Email, Typing & Record Management',
    ],
    imageKey: 'office-management',
    status: 'active',
  },
  {
    id: 'graphic-designing',
    code: 'GD-102',
    title: 'Graphic Designing',
    description:
      'Studio-driven visual communication diploma focused on brand identity, vector illustration, photo manipulation, typography, and print layout.',
    durationMonths: 6,
    feeMonthly: 5500,
    schedule: 'Mon - Fri · 11:30 AM - 01:30 PM',
    teacherId: '',
    teacherName: 'Unassigned',
    teacherEmail: '',
    modules: [
      '01. Visual Hierarchy, Grids & Color Theory',
      '02. Adobe Photoshop Photo Retouching & Compositing',
      '03. Adobe Illustrator Vector Logos & Brand Systems',
      '04. Typography & Social Media Creative Kits',
      '05. Print Pre-Press & Portfolio Capstone',
    ],
    imageKey: 'graphic-designing',
    status: 'active',
  },
  {
    id: 'digital-marketing',
    code: 'DM-103',
    title: 'Digital Marketing',
    description:
      'Applied growth marketing diploma covering search engine optimization, paid social media campaigns, conversion analytics, and content funnels.',
    durationMonths: 6,
    feeMonthly: 5500,
    schedule: 'Mon - Fri · 02:00 PM - 04:00 PM',
    teacherId: '',
    teacherName: 'Unassigned',
    teacherEmail: '',
    modules: [
      '01. Search Engine Optimization (On-Page & Technical)',
      '02. Meta Ads Manager & Audience Targeting',
      '03. Google Search & Display Campaign Strategy',
      '04. Content Copywriting & Lead Generation Funnels',
      '05. Analytics Reporting & ROI Attribution',
    ],
    imageKey: 'digital-marketing',
    status: 'active',
  },
  {
    id: 'web-development',
    code: 'WD-104',
    title: 'Web Development',
    description:
      'Full-stack engineering diploma building responsive interfaces, modern JavaScript and TypeScript applications, backend APIs, and cloud deployment.',
    durationMonths: 12,
    feeMonthly: 7000,
    schedule: 'Mon - Fri · 04:30 PM - 06:30 PM',
    teacherId: '',
    teacherName: 'Unassigned',
    teacherEmail: '',
    modules: [
      '01. Semantic HTML5, Modern CSS & Responsive Systems',
      '02. JavaScript ES6+ & TypeScript Programming',
      '03. React Component Architecture & State Management',
      '04. Backend REST APIs & Database Modeling',
      '05. Git Workflows & Production Web Deployment',
    ],
    imageKey: 'web-development',
    status: 'active',
  },
  {
    id: 'ai-tutor',
    code: 'AT-105',
    title: 'AI Tutor',
    description:
      'Practical applied artificial intelligence diploma focused on structured prompt engineering, intelligent study workflows, data synthesis, and automated tutoring systems.',
    durationMonths: 6,
    feeMonthly: 6500,
    schedule: 'Tue - Sat · 06:30 PM - 08:30 PM',
    teacherId: '',
    teacherName: 'Unassigned',
    teacherEmail: '',
    modules: [
      '01. Foundations of Generative AI & Language Models',
      '02. Precision Prompt Engineering & Reasoning Chains',
      '03. AI Workflows for Research, Coding & Office Automation',
      '04. Building Guided Learning & Knowledge Assistants',
      '05. Verification, Ethics & Applied AI Capstone',
    ],
    imageKey: 'ai-tutor',
    status: 'active',
  },
];
