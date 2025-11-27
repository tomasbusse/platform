import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { User, Company } from '../types';

interface LessonSchedulerProps {
  currentUser: User | null;
  company: Company | null;
  onLessonCreated?: (lessonId: string) => void;
}

interface UploadedFile {
  storageId: Id<"_storage">;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface ScheduledLessonForm {
  title: string;
  description: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  timezone: string;
  locationType: 'online' | 'office' | 'company';
  locationDetails: string;
  meetingLink: string;
  topic: string;
  objectives: string[];
  materials: string[];
  groupId: string;
  teacherId: string;
  assignedStudentIds: string[];
}

const LessonScheduler: React.FC<LessonSchedulerProps> = ({
  currentUser,
  company,
  onLessonCreated,
}) => {
  const [formData, setFormData] = useState<ScheduledLessonForm>({
    title: '',
    description: '',
    level: 'A1',
    scheduledDate: '',
    scheduledTime: '09:00',
    duration: 60,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locationType: 'online',
    locationDetails: '',
    meetingLink: '',
    topic: '',
    objectives: [''],
    materials: [],
    groupId: '',
    teacherId: currentUser?._id || '',
    assignedStudentIds: [],
  });

  const [newObjective, setNewObjective] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch groups and students
  const groups = useQuery(
    api.groups.getCompanyGroups,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  const students = useQuery(
    api.authLegacy.getUsersByCompany,
    company?._id ? { companyId: company._id as Id<"companies"> } : 'skip'
  );

  const createScheduledLesson = useMutation(api.lessons.createScheduledLesson);
  const generateUploadUrl = useMutation(api.lessons.generateUploadUrl);
  const saveLessonMaterial = useMutation(api.lessons.saveLessonMaterial);

  const studentList = students?.filter((u: any) => u.role === 'student' && u.isActive) || [];
  const teacherList = students?.filter((u: any) => (u.role === 'teacher' || u.role === 'admin' || u.role === 'corporate_admin') && u.isActive) || [];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.scheduledDate) newErrors.scheduledDate = 'Date is required';
    if (!formData.scheduledTime) newErrors.scheduledTime = 'Time is required';
    if (!formData.topic.trim()) newErrors.topic = 'Topic is required';
    if (formData.objectives.filter((o) => o.trim()).length === 0) {
      newErrors.objectives = 'At least one objective is required';
    }
    if (formData.locationType === 'online' && !formData.meetingLink.trim()) {
      newErrors.meetingLink = 'Meeting link is required for online lessons';
    }
    if (formData.locationType !== 'online' && !formData.locationDetails.trim()) {
      newErrors.locationDetails = 'Location details are required';
    }
    if (formData.assignedStudentIds.length === 0 && !formData.groupId) {
      newErrors.students = 'Please select a group or individual students';
    }
    if (!formData.teacherId) {
      newErrors.teacherId = 'Please select a teacher';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !currentUser || !company) return;

    setIsSubmitting(true);

    try {
      // Combine date and time
      const dateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
      const scheduledDate = dateTime.getTime();

      // Get student IDs from group if selected
      let studentIds = [...formData.assignedStudentIds];
      if (formData.groupId) {
        const selectedGroup = groups?.find((g) => g._id === formData.groupId);
        if (selectedGroup) {
          studentIds = [...new Set([...studentIds, ...selectedGroup.studentIds])];
        }
      }

      const lessonId = await createScheduledLesson({
        companyId: company._id as Id<"companies">,
        createdBy: currentUser._id as Id<"users">,
        teacherId: formData.teacherId as Id<"users">,
        groupId: formData.groupId ? (formData.groupId as Id<"groups">) : undefined,
        title: formData.title,
        description: formData.description || undefined,
        level: formData.level,
        scheduledDate,
        duration: formData.duration,
        timezone: formData.timezone,
        locationType: formData.locationType,
        locationDetails: formData.locationDetails || undefined,
        meetingLink: formData.meetingLink || undefined,
        topic: formData.topic,
        objectives: formData.objectives.filter((o) => o.trim()),
        materials: formData.materials.filter((m) => m.trim()),
        assignedStudentIds: studentIds,
      });

      // Save uploaded files as lesson materials
      for (const file of uploadedFiles) {
        await saveLessonMaterial({
          companyId: company._id as Id<"companies">,
          scheduledLessonId: lessonId,
          uploadedBy: currentUser._id as Id<"users">,
          storageId: file.storageId,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          category: file.fileType.startsWith('image/') ? 'image' :
                    file.fileType.startsWith('video/') ? 'video' :
                    file.fileType.startsWith('audio/') ? 'audio' :
                    file.fileType.includes('pdf') ? 'document' : 'other',
        });
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Reset form
      setFormData({
        title: '',
        description: '',
        level: 'A1',
        scheduledDate: '',
        scheduledTime: '09:00',
        duration: 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationType: 'online',
        locationDetails: '',
        meetingLink: '',
        topic: '',
        objectives: [''],
        materials: [],
        groupId: '',
        teacherId: currentUser?._id || '',
        assignedStudentIds: [],
      });
      setUploadedFiles([]);

      onLessonCreated?.(lessonId);
    } catch (error) {
      console.error('Error creating lesson:', error);
      setErrors({ submit: 'Failed to create lesson. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setFormData((prev) => ({
        ...prev,
        objectives: [...prev.objectives.filter((o) => o.trim()), newObjective.trim()],
      }));
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index),
    }));
  };

  const addMaterial = () => {
    if (newMaterial.trim()) {
      setFormData((prev) => ({
        ...prev,
        materials: [...prev.materials, newMaterial.trim()],
      }));
      setNewMaterial('');
    }
  };

  const removeMaterial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name}... (${i + 1}/${files.length})`);

        // Step 1: Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Step 2: Upload file to Convex storage
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await response.json();

        // Step 3: Add to uploaded files list
        setUploadedFiles((prev) => [...prev, {
          storageId: storageId as Id<"_storage">,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }]);
      }
      setUploadProgress('');
    } catch (error) {
      console.error('Upload error:', error);
      setErrors((prev) => ({ ...prev, upload: 'Failed to upload file. Please try again.' }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎬';
    if (fileType.startsWith('audio/')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️';
    return '📎';
  };

  const toggleStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedStudentIds: prev.assignedStudentIds.includes(studentId)
        ? prev.assignedStudentIds.filter((id) => id !== studentId)
        : [...prev.assignedStudentIds, studentId],
    }));
  };

  const handleGroupChange = (groupId: string) => {
    setFormData((prev) => {
      if (groupId) {
        const selectedGroup = groups?.find((g) => g._id === groupId);
        return {
          ...prev,
          groupId,
          level: selectedGroup?.level as any || prev.level,
        };
      }
      return { ...prev, groupId: '' };
    });
  };

  if (!currentUser) {
    return <div className="text-simmonds-stone">Please log in to schedule lessons.</div>;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-simmonds-cream">
      <h2 className="text-xl font-bold text-simmonds-charcoal mb-6">Schedule a Lesson</h2>

      {showSuccess && (
        <div className="mb-6 p-4 bg-simmonds-lime/20 text-simmonds-lime-dark rounded-xl">
          Lesson scheduled successfully!
        </div>
      )}

      {errors.submit && (
        <div className="mb-6 p-4 bg-simmonds-terracotta/10 text-simmonds-terracotta rounded-xl">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Lesson Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                errors.title ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
              }`}
              placeholder="e.g., Business English - Meeting Skills"
            />
            {errors.title && <p className="text-sm text-simmonds-terracotta mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Topic *
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData((prev) => ({ ...prev, topic: e.target.value }))}
              className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                errors.topic ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
              }`}
              placeholder="e.g., Present Perfect Tense"
            />
            {errors.topic && <p className="text-sm text-simmonds-terracotta mt-1">{errors.topic}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary h-20"
            placeholder="Brief description of what will be covered in this lesson..."
          />
        </div>

        {/* Date, Time, Level */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                errors.scheduledDate ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
              }`}
            />
            {errors.scheduledDate && (
              <p className="text-sm text-simmonds-terracotta mt-1">{errors.scheduledDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Time *
            </label>
            <input
              type="time"
              value={formData.scheduledTime}
              onChange={(e) => setFormData((prev) => ({ ...prev, scheduledTime: e.target.value }))}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Duration
            </label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData((prev) => ({ ...prev, duration: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
              Level
            </label>
            <select
              value={formData.level}
              onChange={(e) => setFormData((prev) => ({ ...prev, level: e.target.value as any }))}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="A1">A1 - Beginner</option>
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
              <option value="C1">C1 - Advanced</option>
              <option value="C2">C2 - Proficient</option>
            </select>
          </div>
        </div>

        {/* Teacher Assignment */}
        <div>
          <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Assigned Teacher *
          </label>
          <select
            value={formData.teacherId}
            onChange={(e) => setFormData((prev) => ({ ...prev, teacherId: e.target.value }))}
            className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
              errors.teacherId ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
            }`}
          >
            <option value="">-- Select a teacher --</option>
            {teacherList.map((teacher: any) => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.name} ({teacher.email}) - {teacher.role}
              </option>
            ))}
          </select>
          {errors.teacherId && (
            <p className="text-sm text-simmonds-terracotta mt-1">{errors.teacherId}</p>
          )}
          <p className="text-sm text-simmonds-stone mt-1">
            The teacher will be responsible for conducting this lesson and uploading the transcript afterwards.
          </p>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-simmonds-charcoal">
            Location Type *
          </label>
          <div className="flex gap-4">
            {(['online', 'office', 'company'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, locationType: type }))}
                className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                  formData.locationType === type
                    ? 'bg-simmonds-primary text-white'
                    : 'bg-simmonds-cream text-simmonds-charcoal hover:bg-simmonds-cream-light'
                }`}
              >
                {type === 'online' && '🌐 Online'}
                {type === 'office' && '🏢 At Office'}
                {type === 'company' && '🏭 At Company'}
              </button>
            ))}
          </div>

          {formData.locationType === 'online' && (
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Meeting Link * (Zoom, Teams, Meet, etc.)
              </label>
              <input
                type="url"
                value={formData.meetingLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, meetingLink: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                  errors.meetingLink ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
                }`}
                placeholder="https://zoom.us/j/..."
              />
              {errors.meetingLink && (
                <p className="text-sm text-simmonds-terracotta mt-1">{errors.meetingLink}</p>
              )}
            </div>
          )}

          {formData.locationType !== 'online' && (
            <div>
              <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
                Location Address *
              </label>
              <input
                type="text"
                value={formData.locationDetails}
                onChange={(e) => setFormData((prev) => ({ ...prev, locationDetails: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary ${
                  errors.locationDetails ? 'border-simmonds-terracotta' : 'border-simmonds-cream'
                }`}
                placeholder="e.g., Room 201, Building A, 123 Main Street"
              />
              {errors.locationDetails && (
                <p className="text-sm text-simmonds-terracotta mt-1">{errors.locationDetails}</p>
              )}
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        <div>
          <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Learning Objectives *
          </label>
          <div className="space-y-2">
            {formData.objectives.filter((o) => o.trim()).map((objective, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 px-4 py-2 bg-simmonds-cream/50 rounded-xl text-sm">
                  {objective}
                </span>
                <button
                  type="button"
                  onClick={() => removeObjective(index)}
                  className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg"
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                placeholder="e.g., Understand present perfect usage"
              />
              <button
                type="button"
                onClick={addObjective}
                className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light"
              >
                Add
              </button>
            </div>
          </div>
          {errors.objectives && (
            <p className="text-sm text-simmonds-terracotta mt-1">{errors.objectives}</p>
          )}
        </div>

        {/* Materials */}
        <div>
          <label className="block text-sm font-medium text-simmonds-charcoal mb-2">
            Materials & Resources (Optional)
          </label>

          {/* File Upload Section */}
          <div className="mb-4 p-4 border-2 border-dashed border-simmonds-cream rounded-xl hover:border-simmonds-primary/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.mp4,.wav,.webm"
            />
            <div className="text-center">
              <div className="text-3xl mb-2">📁</div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload Files'}
              </button>
              <p className="text-xs text-simmonds-stone mt-2">
                PDF, Documents, Images, Audio, Video (Max 20MB per file)
              </p>
              {uploadProgress && (
                <p className="text-sm text-simmonds-primary mt-2">{uploadProgress}</p>
              )}
              {errors.upload && (
                <p className="text-sm text-simmonds-terracotta mt-2">{errors.upload}</p>
              )}
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-simmonds-charcoal">Uploaded Files:</p>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-simmonds-lime/10 rounded-xl">
                  <span className="text-xl">{getFileIcon(file.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-simmonds-charcoal truncate">{file.fileName}</p>
                    <p className="text-xs text-simmonds-stone">{formatFileSize(file.fileSize)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(index)}
                    className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Links Section */}
          <div className="space-y-2">
            <p className="text-sm text-simmonds-stone">Or add links to external resources:</p>
            {formData.materials.map((material, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <span className="flex-1 px-4 py-2 bg-simmonds-cream/50 rounded-xl text-sm truncate">
                  {material}
                </span>
                <button
                  type="button"
                  onClick={() => removeMaterial(index)}
                  className="p-2 text-simmonds-terracotta hover:bg-simmonds-terracotta/10 rounded-lg"
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMaterial())}
                className="flex-1 px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
                placeholder="https://example.com/resource"
              />
              <button
                type="button"
                onClick={addMaterial}
                className="px-4 py-2 bg-simmonds-olive text-white rounded-xl font-medium hover:bg-simmonds-olive-light"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>

        {/* Student Assignment */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-simmonds-charcoal">
            Assign Students *
          </label>

          <div>
            <label className="block text-sm text-simmonds-stone mb-2">
              Select a Group (optional)
            </label>
            <select
              value={formData.groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full px-4 py-2 border border-simmonds-cream rounded-xl focus:outline-none focus:ring-2 focus:ring-simmonds-primary"
            >
              <option value="">-- No group selected --</option>
              {groups?.filter((g) => g.isActive).map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name} ({group.level}) - {group.currentStudentCount} students
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-simmonds-stone mb-2">
              Or select individual students
            </label>
            <div className="max-h-48 overflow-y-auto border border-simmonds-cream rounded-xl p-3 space-y-2">
              {studentList.length === 0 ? (
                <p className="text-sm text-simmonds-stone">No students available</p>
              ) : (
                studentList.map((student: any) => (
                  <label
                    key={student._id}
                    className="flex items-center gap-3 p-2 hover:bg-simmonds-cream/50 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.assignedStudentIds.includes(student._id)}
                      onChange={() => toggleStudent(student._id)}
                      className="rounded border-simmonds-cream text-simmonds-primary focus:ring-simmonds-primary"
                    />
                    <span className="text-simmonds-charcoal">{student.name}</span>
                    <span className="text-sm text-simmonds-stone">({student.email})</span>
                    {student.currentLevel && (
                      <span className="px-2 py-0.5 bg-simmonds-primary/10 text-simmonds-primary rounded text-xs">
                        {student.currentLevel}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
          {errors.students && (
            <p className="text-sm text-simmonds-terracotta mt-1">{errors.students}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t border-simmonds-cream">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-simmonds-primary text-white rounded-xl font-medium hover:bg-simmonds-primary-light disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Lesson'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LessonScheduler;
