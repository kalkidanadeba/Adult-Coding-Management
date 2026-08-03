import { FaDatabase, FaGitAlt, FaHtml5, FaNodeJs, FaReact } from 'react-icons/fa';

const DEFAULT_ICON = FaHtml5;

const iconByCategory = {
  Frontend: FaReact,
  Backend: FaNodeJs,
  Database: FaDatabase,
  Tools: FaGitAlt,
};

export const withCourseIcon = (course) => {
  const category = course?.category ?? course?.categoryName ?? course?.type ?? null;
  const Icon = course?.Icon ?? iconByCategory[category] ?? DEFAULT_ICON;
  return { ...course, Icon };
};

