import React, { useState } from 'react';
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

  const categories = [
    { id: 'document', label: 'Documents', icon: 'document' },
    { id: 'video', label: 'Videos', icon: 'video' },
    { id: 'audio', label: 'Audio', icon: 'audio' },
    { id: 'image', label: 'Images', icon: 'image' },
    { id: 'link', label: 'Links', icon: 'link' },
  ];

  // Materials feature temporarily disabled - showing placeholder
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

      {/* Materials Grid - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-full text-center py-12">
          <p className="text-gray-500">No materials found</p>
        </div>
      </div>
    </div>
  );
};

export default MaterialsLibrary;
