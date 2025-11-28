import React from 'react';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface LessonMaterialsProps {
  lessonId: Id<"virtualLessons">;
  currentUser: User | null;
  company: Company | null;
  isTeacher?: boolean;
}

const LessonMaterials: React.FC<LessonMaterialsProps> = ({
  lessonId,
  currentUser,
  company,
  isTeacher = false,
}) => {
  // Materials feature temporarily disabled
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Lesson Materials</h3>
      <div className="p-8 text-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">No materials for this lesson yet</p>
      </div>
    </div>
  );
};

export default LessonMaterials;
