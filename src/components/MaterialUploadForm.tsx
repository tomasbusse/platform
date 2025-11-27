import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'document' | 'video' | 'audio' | 'image' | 'link' | 'other'>('document');
  const [accessScope, setAccessScope] = useState<'company' | 'group' | 'individual'>('company');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMaterial = useMutation(api.materials.uploadMaterial);
  const groups = useQuery(api.groups.getCompanyGroups, {
    companyId: company?._id as Id<"companies">,
  });
  const employees = useQuery(api.userManagement.getCompanyEmployees, {
    companyId: company?._id as Id<"companies">,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (category !== 'link' && !file && !externalUrl) {
      setError('Please upload a file or provide an external URL');
      return;
    }

    if (accessScope === 'group' && selectedGroups.length === 0) {
      setError('Please select at least one group');
      return;
    }

    if (accessScope === 'individual' && selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }

    setIsUploading(true);

    try {
      // TODO: Upload file to Convex storage if file exists
      let storageId: Id<"_storage"> | undefined;
      if (file) {
        // This would require using Convex's file upload API
        // For now, we'll just store the file metadata
        console.log('File upload would happen here:', file);
      }

      await uploadMaterial({
        companyId: company?._id as Id<"companies">,
        title,
        description,
        category,
        fileName: file?.name || 'external-link',
        fileType: file?.type || 'text/plain',
        fileSize: file?.size || 0,
        storageId,
        externalUrl: externalUrl || undefined,
        accessScope,
        accessGroupIds: accessScope === 'group' ? (selectedGroups as Id<"groups">[]) : undefined,
        accessStudentIds: accessScope === 'individual' ? selectedStudents : undefined,
        virtualLessonId: lessonId ? (lessonId as Id<"virtualLessons">) : undefined,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('document');
      setAccessScope('company');
      setSelectedGroups([]);
      setSelectedStudents([]);
      setExternalUrl('');
      setFile(null);

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload material');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Upload Learning Material</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          placeholder="e.g., Grammar Lesson PDF"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          placeholder="Describe the material..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          >
            <option value="document">Document</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="image">Image</option>
            <option value="link">Link</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
          <select
            value={accessScope}
            onChange={(e) => setAccessScope(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          >
            <option value="company">Company-wide</option>
            <option value="group">Specific Groups</option>
            <option value="individual">Specific Students</option>
          </select>
        </div>
      </div>

      {accessScope === 'group' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Groups</label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {groups?.map((group: any) => (
              <label key={group._id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGroups([...selectedGroups, group._id]);
                    } else {
                      setSelectedGroups(selectedGroups.filter((id) => id !== group._id));
                    }
                  }}
                  className="mr-2"
                />
                <span>{group.name} ({group.level})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {accessScope === 'individual' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Students</label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {employees?.filter((emp: any) => emp.role === 'student').map((student: any) => (
              <label key={student._id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStudents([...selectedStudents, student._id]);
                    } else {
                      setSelectedStudents(selectedStudents.filter((id) => id !== student._id));
                    }
                  }}
                  className="mr-2"
                />
                <span>{student.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {category === 'link' ? 'External URL' : 'Upload File'}
        </label>
        {category === 'link' ? (
          <input
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            placeholder="https://example.com"
          />
        ) : (
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="w-full px-4 py-2 bg-simmonds-primary text-white rounded-lg font-medium hover:bg-simmonds-primary/90 disabled:opacity-50 transition-colors"
      >
        {isUploading ? 'Uploading...' : 'Upload Material'}
      </button>
    </form>
  );
};

export default MaterialUploadForm;

