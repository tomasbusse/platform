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

  if (!recentMaterials || recentMaterials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Recent Materials</h3>
        <p className="text-gray-500 text-center py-8">No materials available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">📚 Recent Materials</h3>
        <a href="/materials" className="text-simmonds-primary hover:underline text-sm font-medium">
          View All →
        </a>
      </div>

      <div className="space-y-3">
        {recentMaterials.map((material: any) => (
          <div
            key={material._id}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-xl">{getCategoryIcon(material.category)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{material.title}</p>
              <p className="text-xs text-gray-500">
                {new Date(material.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs bg-simmonds-primary/10 text-simmonds-primary px-2 py-1 rounded whitespace-nowrap">
              {material.accessScope}
            </span>
          </div>
        ))}
      </div>

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

export default RecentMaterialsWidget;

