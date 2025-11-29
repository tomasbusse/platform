import React, { useState } from 'react';
import { User, Company } from '../types';
import MaterialsLibrary from '../components/MaterialsLibrary';
import MaterialUploadForm from '../components/MaterialUploadForm';
import MaterialNotifications from '../components/MaterialNotifications';

interface MaterialsPageProps {
  currentUser: User | null;
  company: Company | null;
}

const MaterialsPage: React.FC<MaterialsPageProps> = ({ currentUser, company }) => {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'corporate_admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-simmonds-charcoal">Learning Materials</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Access and manage learning resources</p>
          </div>
          {isTeacher && (
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-simmonds-primary text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-simmonds-primary/90 transition-colors"
            >
              {showUploadForm ? '✕ Close' : '+ Upload Material'}
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="mb-4 sm:mb-8">
          <MaterialNotifications currentUser={currentUser} company={company} />
        </div>

        {/* Upload Form */}
        {isTeacher && showUploadForm && (
          <div className="mb-4 sm:mb-8">
            <MaterialUploadForm
              company={company}
              currentUser={currentUser}
              onSuccess={() => setShowUploadForm(false)}
            />
          </div>
        )}

        {/* Materials Library */}
        <MaterialsLibrary currentUser={currentUser} company={company} />
      </div>
    </div>
  );
};

export default MaterialsPage;

