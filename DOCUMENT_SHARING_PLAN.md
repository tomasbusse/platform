# Document Sharing System - Implementation Plan

## Overview
Teachers can upload and share learning materials (documents, PDFs, videos, etc.) at three levels:
1. **Company-wide** - All users in the company can access
2. **Group-level** - Only specific groups can access
3. **Individual-level** - Only specific users can access

Materials are associated with lessons and can be accessed from the lesson page.

## Database Schema

### lessonMaterials (Already exists in schema.ts)
```
- companyId: Company the material belongs to
- scheduledLessonId: Optional - associated scheduled lesson
- virtualLessonId: Optional - associated virtual lesson
- uploadedBy: User who uploaded (teacher)
- fileName: Original file name
- fileType: MIME type (pdf, docx, mp4, etc.)
- fileSize: Size in bytes
- storageId: Convex storage ID (for uploaded files)
- externalUrl: Optional external link
- title: Display title
- description: Description
- category: document, video, audio, image, link, other
- accessLevel: 'company' | 'group' | 'individual'
- accessGroupIds: Array of group IDs (if group-level)
- accessUserIds: Array of user IDs (if individual-level)
- isPublished: Boolean
- createdAt, updatedAt: Timestamps
```

## Features to Implement

### 1. Upload Functionality
- File upload component in lesson management
- Support multiple file types (PDF, DOCX, MP4, MP3, images, etc.)
- File size validation (max 100MB)
- Progress indicator during upload

### 2. Access Control
- Teachers can set access level when uploading
- Company-wide: All users see it
- Group-level: Select which groups can access
- Individual-level: Select which users can access

### 3. Material Management
- View all materials for a lesson
- Edit material metadata (title, description, category)
- Delete materials
- Publish/unpublish materials
- Reorder materials

### 4. Student Access
- View materials in lesson page
- Download materials
- Filter by category
- Search materials

### 5. Teacher Dashboard
- Upload new materials
- Manage existing materials
- View access statistics
- Bulk operations

## Implementation Steps

1. **Update schema** - Add access control fields to lessonMaterials
2. **Create upload mutations** - uploadLessonMaterial, updateMaterialAccess
3. **Create access queries** - getMaterialsForUser, getMaterialsForGroup
4. **Create UI components**:
   - MaterialUploadForm
   - MaterialAccessSelector
   - MaterialsList
   - MaterialViewer
5. **Integrate with lessons** - Add materials section to lesson pages
6. **Add to teacher tools** - Material management dashboard

## File Type Support
- Documents: PDF, DOCX, XLSX, PPTX, TXT
- Videos: MP4, WebM, OGG
- Audio: MP3, WAV, OGG
- Images: JPG, PNG, GIF, WebP
- Links: Any external URL

## Security Considerations
- Verify user has access before serving file
- Validate file types on upload
- Scan for malware (optional)
- Rate limit downloads
- Log access to materials

