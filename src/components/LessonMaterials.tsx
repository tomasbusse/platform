import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import MaterialUploadForm from './MaterialUploadForm';
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
  const [showUploadForm, setShowUploadForm] = useState(false);

  const materials = useQuery(api.materials.getMaterialsForLesson, {
    lessonId,
  });

  const trackDownload = useMutation(api.materials.trackMaterialDownload);

  const handleDownload = async (material: any) => {
    try {
      await trackDownload({
        materialId: material._id,
        userId: currentUser?._id || '',
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      });

      if (material.externalUrl) {
        window.open(material.externalUrl, '_blank');
      } else if (material.storageId) {
        const response = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storageId: material.storageId }),
        }).then((r) => r.json());

        if (response.url) {
          window.open(response.url, '_blank');
        }
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  if (!materials) {
    return <div className="p-4 text-center">Loading materials...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">📚 Lesson Materials</h3>
        {isTeacher && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="px-3 py-1 text-sm bg-simmonds-primary text-white rounded-lg hover:bg-simmonds-primary/90"
          >
            {showUploadForm ? '✕' : '+ Add'}
          </button>
        )}
      </div>

      {isTeacher && showUploadForm && (
        <MaterialUploadForm
          company={company}
          currentUser={currentUser}
          lessonId={lessonId}
          onSuccess={() => setShowUploadForm(false)}
        />
      )}

      {materials.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No materials for this lesson yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {materials.map((material: any) => (
            <div
              key={material._id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 flex-1">{material.title}</h4>
                <span className="text-lg">{getCategoryIcon(material.category)}</span>
              </div>

              {material.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{material.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{formatFileSize(material.fileSize)}</span>
                <span>{new Date(material.createdAt).toLocaleDateString()}</span>
              </div>

              <button
                onClick={() => handleDownload(material)}
                className="w-full px-3 py-2 bg-simmonds-primary text-white text-sm rounded-lg hover:bg-simmonds-primary/90 transition-colors"
              >
                {material.externalUrl ? 'Open Link' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    document: '📄',
    video: '🎥',
    audio: '🎵',
    image: '🖼️',
    link: '🔗',
    other: '📦',
  };
  return icons[category] || '📦';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default LessonMaterials;

