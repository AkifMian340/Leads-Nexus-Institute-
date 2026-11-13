import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { COURSE_IMAGES } from '../../data/defaultCourses';

interface CourseThumbnailProps {
  imageKey: string;
  title: string;
  className?: string;
}

export function CourseThumbnail({ imageKey, title, className = '' }: CourseThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  const src = COURSE_IMAGES[imageKey];

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 ${className}`}
      >
        <BookOpen className="h-7 w-7 text-blue-700 mb-1.5" strokeWidth={1.75} />
        <span className="text-xs font-medium text-slate-700 px-3 text-center truncate max-w-full">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-cover ${className}`}
    />
  );
}
