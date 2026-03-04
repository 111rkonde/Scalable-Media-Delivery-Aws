# S3 Media Gallery - Application Workflow & Data Flow

This document explains how the S3 Media Gallery application works, from user interactions to data flow through the system.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AWS S3        │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (Cloud)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Current Implementation:**
- **Open Access**: No authentication required
- **Shared Storage**: All users see the same files
- **5GB Upload Limit**: Large file support
- **Direct Upload**: Multer with memory storage

## 🔄 Complete Data Flow

### 1. Initial Page Load

```
User visits website (http://localhost:3000)
        ↓
Browser loads index.html, styles.css, script.js
        ↓
JavaScript initializes MediaGallery class
        ↓
Calls API: GET /api/files
        ↓
Backend fetches file list from S3 bucket
        ↓
S3 returns file metadata (keys, sizes, dates)
        ↓
Backend generates signed URLs for each file (1-hour expiry)
        ↓
Frontend renders gallery grid with images/videos/audio
```

**Key Components:**
- No login required - direct access to gallery
- Files stored in `uploads/` folder in S3
- Signed URLs provide secure temporary access

### 2. File Upload Process

```
User clicks "Upload Files" button
        ↓
Upload modal opens with drag & drop area
        ↓
User drags & drops or selects files (up to 5GB each)
        ↓
Frontend validates file size (5GB limit)
        ↓
FormData created and sent to API: POST /api/upload
        ↓
Backend receives file via multer middleware
        ↓
File stored in memory buffer
        ↓
Backend generates unique key: uploads/timestamp-random-filename
        ↓
Backend uploads to S3 with ACL: 'private'
        ↓
S3 stores file and returns metadata
        ↓
Backend responds with success info
        ↓
Frontend shows upload progress and refreshes gallery
```

**Upload Validation:**
- Frontend: 5GB size limit check
- Backend: Multer limit set to 5GB
- File types: Images, videos, audio, documents
- Storage: Memory buffer (for files up to 5GB)

### 3. File Preview Process

```
User clicks on gallery item
        ↓
Frontend opens preview modal
        ↓
Displays media using signed URL
        ↓
Options: Download, Delete, Close
        ↓
User can interact with media player
```

### 4. File Download Process

```
User clicks download button in preview
        ↓
Frontend creates download link with signed URL
        ↓
Browser downloads file directly from S3
        ↓
Signed URL expires after 1 hour
```

### 5. File Delete Process

```
User clicks delete button in preview
        ↓
Confirmation dialog appears
        ↓
If confirmed: DELETE /api/files/:key
        ↓
Backend calls S3: deleteObject()
        ↓
S3 removes file permanently
        ↓
Backend responds with success
        ↓
Frontend closes preview and refreshes gallery
```

## 🔧 Backend API Endpoints

### GET /api/files

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Files per page (default: 50)
- `type`: Filter by type ('image', 'video', 'audio', 'all')
- `search`: Search query for filenames

**Backend Process:**
1. Calls S3: `listObjectsV2()` with MaxKeys: 1000
2. Filters files by type and search criteria
3. Adds metadata (size, type, extension)
4. Implements pagination
5. Generates signed URLs for each file
6. Returns paginated response

**Response:**
```json
{
  "files": [
    {
      "key": "uploads/1234567890-abc123-image.jpg",
      "size": 1024000,
      "lastModified": "2026-03-04T08:46:41.000Z",
      "type": "image",
      "extension": ".jpg",
      "url": "https://s3.amazonaws.com/.../image.jpg?X-Amz-Signature=..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalFiles": 2,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### POST /api/upload

**Request:**
- Content-Type: `multipart/form-data`
- File: Binary file data (up to 5GB)

**Backend Process:**
1. Multer middleware validates file size (5GB limit)
2. Generates unique key with timestamp and random string
3. Uploads to S3 with ACL: 'private'
4. Returns success response with file metadata

**Response:**
```json
{
  "message": "File uploaded successfully",
  "key": "uploads/1234567890-abc123-image.jpg",
  "size": 1024000,
  "type": "image"
}
```

### DELETE /api/files/:key

**Request:**
```javascript
DELETE /api/files/uploads%2Fimage.jpg
```

**Backend Process:**
1. URL decodes the file key
2. Calls S3: `deleteObject()`
3. S3 removes file permanently
4. Backend responds with success

### GET /api/files/:key/info

**Backend Process:**
1. Calls S3: `headObject()` to get file metadata
2. Returns detailed file information

### GET /api/health

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-03-04T08:46:41.000Z"
}
```

## 🎨 Frontend Component Flow

### MediaGallery Class Initialization

```javascript
class MediaGallery {
  constructor() {
    this.files = [];
    this.currentPage = 1;
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.currentPreviewFile = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadFiles();
  }
}
```

### Event Binding

```javascript
bindEvents() {
  // Upload button
  document.getElementById('uploadBtn').addEventListener('click', () => {
    this.showUploadModal();
  });

  // File selection
  document.getElementById('fileInput').addEventListener('change', (e) => {
    this.handleFileSelect(e.target.files);
  });

  // Drag and drop
  const uploadArea = document.getElementById('uploadArea');
  uploadArea.addEventListener('drop', (e) => {
    this.handleFileSelect(e.dataTransfer.files);
  });

  // Search and filter
  document.getElementById('searchInput').addEventListener('input', (e) => {
    this.currentSearch = e.target.value;
    this.debounceSearch();
  });

  // Pagination
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadFiles();
    }
  });
}
```

### File Upload Handling

```javascript
async handleFileSelect(files) {
  // Validate file sizes (5GB limit)
  const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
  const validFiles = [];
  
  for (const file of files) {
    if (file.size > maxSize) {
      this.showToast(`${file.name} exceeds 5GB limit`, 'error');
      continue;
    }
    validFiles.push(file);
  }

  // Upload each file with progress
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    await this.uploadFile(file, uploadItem);
  }
}

async uploadFile(file, uploadItem) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  this.updateUploadItem(uploadItem, file.name, 'success');
  return result;
}
```

### Gallery Rendering

```javascript
renderGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  
  if (this.files.length === 0) {
    galleryGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <i class="fas fa-folder-open" style="font-size: 3rem; color: #667eea;"></i>
        <h3>No files found</h3>
        <p>Upload some files to get started!</p>
      </div>
    `;
    return;
  }

  galleryGrid.innerHTML = this.files.map(file => this.createGalleryItem(file)).join('');
  
  // Add click events to gallery items
  galleryGrid.querySelectorAll('.gallery-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      this.showPreview(this.files[index]);
    });
  });
}
```

## 🔒 Security Flow

### 1. S3 Security

```
Private S3 Bucket (ACL: private)
        ↓
Files not publicly accessible
        ↓
Signed URLs provide temporary access (1 hour)
        ↓
AWS IAM user with limited permissions
```

**IAM Permissions:**
- `s3:ListBucket` - List files
- `s3:GetObject` - Download files
- `s3:PutObject` - Upload files
- `s3:DeleteObject` - Delete files

### 2. Application Security

```
Helmet.js - Security headers
        ↓
CORS - Cross-origin request control
        ↓
Rate Limiting - Prevent abuse (100 requests/15min)
        ↓
File Size Limits - 5GB maximum
        ↓
Input Validation - All user inputs validated
```

## 📁 File Storage Structure

### S3 Bucket Organization

```
web-project-666/
└── uploads/
    ├── 1672614003064-vff2nd-WIN_20260128_09_10_18_Pro.jpg
    ├── 1672614003810-qhsyro-WIN_20260301_15_27_01_Pro.jpg
    ├── 1672614004567-rtyuio-video.mp4
    └── 1672614005234-ghjklm-audio.mp3
```

**File Naming Convention:**
- Format: `timestamp-randomString-originalName`
- Timestamp: Unix timestamp for uniqueness
- Random: 6-character random string
- Original: Preserves original filename

## 🎯 User Journey Scenarios

### Scenario 1: First Time User

1. **Visit Website**: User goes to `http://localhost:3000`
2. **View Gallery**: Sees existing files in gallery grid
3. **Upload Files**: Clicks upload button, drags files
4. **File Validation**: System checks file sizes (5GB limit)
5. **Upload Progress**: Shows progress bar for each file
6. **Gallery Refresh**: Files appear in gallery after upload
7. **Media Interaction**: Click files to preview, download, or delete

### Scenario 2: File Management

1. **Search Files**: Uses search bar to find specific files
2. **Filter by Type**: Selects image/video/audio filter
3. **Pagination**: Navigates through multiple pages
4. **Preview Media**: Clicks file to open preview modal
5. **Download**: Clicks download button to save file
6. **Delete**: Removes unwanted files with confirmation

### Scenario 3: Large File Upload

1. **Select Large File**: Chooses file up to 5GB
2. **Validation**: Frontend checks file size
3. **Upload Process**: File uploaded via memory buffer
4. **Progress Tracking**: Visual progress indicator
5. **Success Confirmation**: File appears in gallery

## 🔄 Error Handling Flow

### Frontend Errors

```
File Upload Errors
        ↓
Show toast notification with error message
        ↓
User can retry or select different files
```

### Backend Errors

```
S3 API Errors
        ↓
Log error details
        ↓
Return 500 status with error message
        ↓
Frontend shows error toast
```

### Network Errors

```
Connection Issues
        ↓
Frontend shows "Failed to load files" message
        ↓
Retry button available
        ↓
User can attempt to reload
```

## 📊 Performance Optimization

### Frontend Optimization

```
Lazy Loading
        ↓
Images load as needed
        ↓
Reduces initial page load time

Debounced Search
        ↓
300ms delay on search input
        ↓
Reduces API calls

Pagination
        ↓
Limits files per page (50)
        ↓
Improves rendering performance
```

### Backend Optimization

```
Signed URL Caching
        ↓
URLs valid for 1 hour
        ↓
Reduces S3 API calls

Efficient S3 Queries
        ↓
MaxKeys: 1000 per request
        ↓
Minimizes S3 list operations

Memory Management
        ↓
Files processed in memory
        ↓
Fast upload for files up to 5GB
```

## 🚀 Scalability Considerations

### Current Limitations

- **Memory Usage**: Files stored in memory during upload
- **Single Instance**: No load balancing
- **No Database**: File metadata from S3 only
- **No CDN**: Direct S3 access

### Scaling Solutions

1. **Database Integration**: Store file metadata in database
2. **Load Balancing**: Multiple server instances
3. **CDN Implementation**: CloudFront for static assets
4. **Streaming Upload**: Handle very large files efficiently
5. **Background Processing**: Queue uploads for better performance

## 🎨 UI/UX Flow

### Responsive Design

```
Desktop (≥768px)
        ↓
4-column gallery grid
        ↓
Full upload modal

Tablet (768px-1024px)
        ↓
3-column gallery grid
        ↓
Optimized modal size

Mobile (≤768px)
        ↓
2-column gallery grid
        ↓
Full-screen upload modal
```

### User Feedback

```
Loading States
        ↓
Spinner animation
        ↓
Progress bars for uploads

Error Messages
        ↓
Toast notifications
        ↓
Clear error descriptions

Success Feedback
        ↓
Success toasts
        ↓
Gallery auto-refresh
```

This workflow documentation reflects the current implementation of the S3 Media Gallery with open access, 5GB upload limits, and shared file storage.
