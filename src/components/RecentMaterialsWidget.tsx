import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface RecentMaterialsWidgetProps {
  currentUser: User | null;
  company: Company | null;
  isTeacher?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'document':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'video':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'audio':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case 'image':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'link':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
};

const getCategoryStyle = (category: string) => {
  switch (category) {
    case 'document':
      return 'bg-blue-50 text-blue-600';
    case 'video':
      return 'bg-red-50 text-red-600';
    case 'audio':
      return 'bg-purple-50 text-purple-600';
    case 'image':
      return 'bg-green-50 text-green-600';
    case 'link':
      return 'bg-teal-50 text-teal-600';
    default:
      return 'bg-gray-50 text-gray-600';
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const RecentMaterialsWidget: React.FC<RecentMaterialsWidgetProps> = ({
  currentUser,
  company,
  isTeacher = false,
}) => {
  if (!company || !currentUser) {
    return null;
  }

  // Get materials accessible to user
  const materials = useQuery(api.materials.getMaterialsForUser, {
    companyId: company._id as Id<"companies">,
    userId: currentUser._id as Id<"users">,
    groupIds: (currentUser.groupIds || []) as Id<"groups">[],
  });

  // Get recent materials (last 5)
  const recentMaterials = (materials || [])
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-simmonds-cream overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-simmonds-cream">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-simmonds-charcoal flex items-center gap-2">
            <svg className="w-5 h-5 text-simmonds-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Recent Materials
          </h2>
        </div>
      </div>

      {/* Materials list */}
      <div className="divide-y divide-simmonds-cream/50">
        {!recentMaterials || recentMaterials.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-simmonds-cream flex items-center justify-center">
              <svg className="w-7 h-7 text-simmonds-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-simmonds-stone">No materials available yet</p>
          </div>
        ) : (
          recentMaterials.map((material: any) => (
            <a
              key={material._id}
              href={material.url || material.externalUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 sm:p-4 hover:bg-simmonds-cream/30 transition-colors group"
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getCategoryStyle(material.category)}`}>
                {getCategoryIcon(material.category)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-simmonds-charcoal truncate group-hover:text-simmonds-primary transition-colors">
                  {material.title || material.fileName}
                </p>
                <div className="flex items-center gap-2 text-xs text-simmonds-stone">
                  <span>{new Date(material.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  {material.fileSize && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-simmonds-stone/50"></span>
                      <span>{formatFileSize(material.fileSize)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className={`hidden sm:inline-flex text-xs px-2 py-1 rounded-md ${
                  material.accessScope === 'company' ? 'bg-blue-50 text-blue-700' :
                  material.accessScope === 'group' ? 'bg-amber-50 text-amber-700' :
                  'bg-purple-50 text-purple-700'
                }`}>
                  {material.accessScope}
                </span>
                <svg className="w-4 h-4 text-simmonds-stone group-hover:text-simmonds-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      {isTeacher && (
        <div className="p-3 sm:p-4 border-t border-simmonds-cream bg-simmonds-cream/20">
          <button className="w-full px-4 py-2.5 bg-simmonds-primary text-white rounded-lg font-medium text-sm hover:bg-simmonds-primary/90 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Material
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentMaterialsWidget;

