import React from 'react';
import { User, Company } from '../types';

interface RecentMaterialsWidgetProps {
  currentUser: User | null;
  company: Company | null;
  isTeacher?: boolean;
}

const RecentMaterialsWidget: React.FC<RecentMaterialsWidgetProps> = ({
  currentUser,
  company,
  isTeacher = false,
}) => {
  if (!company || !currentUser) {
    return null;
  }

  // Materials feature temporarily disabled
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Materials</h3>
      <p className="text-gray-500 text-center py-8">No materials available yet</p>
      {isTeacher && (
        <a
          href="/materials/upload"
          className="mt-4 block w-full px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium text-center hover:bg-simmonds-primary/90 transition-colors"
        >
          + Upload Material
        </a>
      )}
    </div>
  );
};

export default RecentMaterialsWidget;
