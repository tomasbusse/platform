import React, { useState } from 'react';
import { User, Company } from '../types';
import MaterialsLibrary from '../components/MaterialsLibrary';
import MaterialUploadForm from '../components/MaterialUploadForm';

interface MaterialsPageProps {
  currentUser: User | null;
  company: Company | null;
}

const MaterialsPage: React.FC<MaterialsPageProps> = ({ currentUser, company }) => {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'corporate_admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-simmonds-cream to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-simmonds-charcoal">Learning Materials</h1>
            <p className="text-gray-600 mt-2">Access and manage learning resources</p>
          </div>
          {isTeacher && (
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="px-6 py-3 bg-simmonds-primary text-white rounded-lg font-semibold hover:bg-simmonds-primary/90 transition-colors"
            >
              {showUploadForm ? '✕ Close' : '+ Upload Material'}
            </button>
          )}
        </div>

        {/* Upload Form */}
        {isTeacher && showUploadForm && (
          <div className="mb-8">
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

