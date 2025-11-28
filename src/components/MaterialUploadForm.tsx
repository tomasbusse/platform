import React from 'react';
import { User, Company } from '../types';

interface MaterialUploadFormProps {
  company: Company | null;
  currentUser: User | null;
  lessonId?: string;
  onSuccess?: () => void;
}

const MaterialUploadForm: React.FC<MaterialUploadFormProps> = ({
  company,
  currentUser,
  lessonId,
  onSuccess,
}) => {
  // Materials upload feature temporarily disabled
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Learning Material</h2>
      <p className="text-gray-500 text-center py-8">Material upload is temporarily unavailable</p>
    </div>
  );
};

export default MaterialUploadForm;
