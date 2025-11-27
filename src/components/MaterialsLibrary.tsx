import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface MaterialsLibraryProps {
  currentUser: User | null;
  company: Company | null;
}

const MaterialsLibrary: React.FC<MaterialsLibraryProps> = ({ currentUser, company }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!company || !currentUser) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  // Get user's groups
  const userGroups = currentUser.groupIds || [];

  // Get materials accessible to user
  const materials = useQuery(api.materials.getMaterialsForUser, {
    companyId: company._id as Id<"companies">,
    userId: currentUser._id,
    groupIds: userGroups as Id<"groups">[],
  });

  const categories = [
    { id: 'document', label: '📄 Documents', icon: '📄' },
    { id: 'video', label: '🎥 Videos', icon: '🎥' },
    { id: 'audio', label: '🎵 Audio', icon: '🎵' },
    { id: 'image', label: '🖼️ Images', icon: '🖼️' },
    { id: 'link', label: '🔗 Links', icon: '🔗' },
  ];

  const filteredMaterials = (materials || []).filter((material: any) => {
    const matchesCategory = !selectedCategory || material.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      material.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const trackDownload = useMutation(api.materials.trackMaterialDownload);
  const generateDownloadUrl = useQuery(api.materials.generateDownloadUrl, {
    materialId: undefined as any,
  });

  const handleDownload = async (material: any) => {
    try {
      // Track the download
      await trackDownload({
        materialId: material._id,
        userId: currentUser?._id || '',
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      });

      // Generate and open download URL
      if (material.externalUrl) {
        window.open(material.externalUrl, '_blank');
      } else if (material.storageId) {
        // Get download URL from Convex storage
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-simmonds-charcoal mb-2">Learning Materials Library</h1>
        <p className="text-gray-600">Access all shared learning materials for your courses</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <input
          type="text"
          placeholder="Search materials..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-simmonds-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Materials
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-simmonds-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.length > 0 ? (
          filteredMaterials.map((material: any) => (
            <div key={material._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{getCategoryIcon(material.category)}</div>
                <span className="text-xs bg-simmonds-primary/10 text-simmonds-primary px-2 py-1 rounded">
                  {material.accessScope}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{material.title}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{material.description}</p>

              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>{formatFileSize(material.fileSize)}</span>
                <span>{new Date(material.createdAt).toLocaleDateString()}</span>
              </div>

              <button
                onClick={() => handleDownload(material)}
                className="w-full px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 transition-colors"
              >
                {material.externalUrl ? 'Open Link' : 'Download'}
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500">No materials found</p>
          </div>
        )}
      </div>
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

export default MaterialsLibrary;

