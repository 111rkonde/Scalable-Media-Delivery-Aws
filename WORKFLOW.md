# Application Workflow & Data Flow

This document explains how the S3 Media Gallery application works, from user interactions to data flow through the system.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AWS S3        │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (Cloud)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔄 Complete Data Flow

### 1. Initial Page Load

```
User visits website
        ↓
Browser loads index.html, styles.css, script.js
        ↓
JavaScript initializes MediaGallery class
        ↓
Calls API: GET /api/files
        ↓
Backend fetches file list from S3
        ↓
S3 returns file metadata
        ↓
Backend generates signed URLs for each file
        ↓
Frontend renders gallery grid
```

### 2. File Upload Process

```
User clicks "Upload Files" button
        ↓
Upload modal opens
        ↓
User drags & drops or selects files
        ↓
Frontend validates file size and type
        ↓
FormData created and sent to API: POST /api/upload
        ↓
Backend receives file via multer middleware
        ↓
AWS SDK uploads file to S3 bucket
        ↓
S3 stores file and returns success
        ↓
Backend responds with file metadata
        ↓
Frontend shows success message
        ↓
Gallery refreshes to show new file
```

### 3. File Preview Process

```
User clicks on gallery item
        ↓
Frontend opens preview modal
        ↓
Media element rendered based on file type:
   - Image: <img> tag with signed URL
   - Video: <video> tag with controls
   - Audio: <audio> tag with controls
        ↓
User can play/view media directly
        ↓
Download/Delete buttons available
```

## 🔐 Security Flow

### Signed URL Generation

```
Backend needs to provide file access
        ↓
Creates S3 signed URL request:
   - Bucket: web-project-666
   - Key: filename
   - Expires: 1 hour
   - Method: GET
        ↓
AWS SDK generates temporary URL
        ↓
URL returned to frontend
        ↓
Frontend uses URL for media display
        ↓
URL expires after 1 hour
```

### Authentication & Authorization

```
No user authentication required
        ↓
Security through obscurity:
   - S3 bucket is private
   - Only signed URLs work
   - URLs expire quickly
        ↓
Rate limiting prevents abuse
        ↓
CORS restricts cross-origin access
        ↓
Helmet.js adds security headers
```

## 📊 API Endpoints & Data Flow

### GET /api/files

**Request:**
```javascript
GET /api/files?page=1&limit=20&type=all&search=example
```

**Backend Process:**
1. Validates query parameters
2. Calls S3: `listObjectsV2()`
3. Filters by type if specified
4. Searches filenames if query provided
5. Implements pagination
6. Generates signed URLs for each file
7. Returns paginated response

**Response:**
```json
{
  "files": [
    {
      "key": "video.mp4",
      "size": 12345678,
      "type": "video",
      "url": "https://signed-url-for-1-hour"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalFiles": 100
  }
}
```

### POST /api/upload

**Request:**
```javascript
POST /api/upload
Content-Type: multipart/form-data
Body: FormData with file
```

**Backend Process:**
1. Multer middleware validates and receives file
2. Generates unique S3 key: `uploads/timestamp-random-filename`
3. Calls S3: `upload()` with file buffer
4. S3 stores file and returns metadata
5. Backend responds with success info

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

## 🎯 Frontend Component Flow

### MediaGallery Class Initialization

```javascript
class MediaGallery {
  constructor() {
    this.files = [];
    this.currentPage = 1;
    this.currentFilter = 'all';
    this.currentSearch = '';
    
    this.init(); // Binds events, loads files
  }
}
```

### Event Handling Flow

```
User Action → Event Listener → Method Call → API Request → UI Update
```

**Examples:**
- Search input → `debounceSearch()` → `loadFiles()` → Filtered gallery
- Filter dropdown → `loadFiles()` → Filtered gallery
- Pagination click → `loadFiles()` → New page
- Upload button → `showUploadModal()` → Modal display

### Rendering Flow

```javascript
loadFiles() → renderGallery() → createGalleryItem() → DOM update
```

Each gallery item includes:
- File preview (image thumbnail, video placeholder, audio icon)
- File metadata (name, size, type badge)
- Click event for preview modal

## 🔄 Error Handling Flow

### Frontend Errors

```
API request fails
        ↓
.catch() block executed
        ↓
showError() method called
        ↓
Error state displayed
        ↓
Retry button available
```

### Backend Errors

```
AWS SDK error occurs
        ↓
try/catch block catches error
        ↓
Error logged to console
        ↓
500 response sent to frontend
        ↓
Frontend shows error message
```

### Common Error Scenarios

1. **S3 Access Denied**: Check IAM permissions
2. **File Too Large**: 50MB limit enforced
3. **Invalid File Type**: Supported formats only
4. **Network Error**: Retry mechanism available
5. **Rate Limit Exceeded**: 429 response with retry info

## 📱 Mobile vs Desktop Flow

### Responsive Design Flow

```
Page loads
        ↓
CSS media queries apply
        ↓
Layout adjusts to screen size:
   - Desktop: 4-column grid
   - Tablet: 2-3 column grid
   - Mobile: 1-2 column grid
        ↓
Touch events enabled on mobile
        ↓
Modal adapts to screen size
```

## 🚀 Performance Optimization Flow

### Loading Performance

```
User requests page
        ↓
Static assets served from Express
        ↓
Images lazy-loaded as needed
        ↓
Pagination limits initial load
        ↓
Signed URLs cached for 1 hour
```

### Upload Performance

```
User selects files
        ↓
Files validated client-side
        ↓
Progress bar shows upload status
        ↓
Multiple files uploaded sequentially
        ↓
Gallery refreshes after all uploads
```

## 🔍 Search & Filter Flow

### Search Process

```
User types in search box
        ↓
debounceSearch() waits 300ms
        ↓
loadFiles() called with search query
        ↓
Backend filters S3 results
        ↓
Matching files returned
        ↓
Gallery updates with filtered results
```

### Filter Process

```
User selects file type filter
        ↓
loadFiles() called with type parameter
        ↓
Backend filters by MIME type
        ↓
Gallery shows only selected type
```

## 📊 Statistics Flow

```
Files loaded from API
        ↓
updateStats() method called
        ↓
Counts calculated:
   - Total files
   - Images count
   - Videos count
   - Audio count
        ↓
Stats dashboard updated
```

## 🎨 UI State Management

### Loading States

```
API request in progress
        ↓
showLoading() displays spinner
        ↓
Gallery hidden during load
        ↓
hideLoading() when complete
```

### Modal States

```
Upload button clicked
        ↓
showUploadModal() → Modal visible
        ↓
File upload completes
        ↓
hideUploadModal() → Modal hidden
```

### Error States

```
API error occurs
        ↓
showError() displays error message
        ↓
Retry button available
        ↓
User can retry operation
```

## 🔧 Configuration Flow

### Environment Variables

```
Application starts
        ↓
dotenv loads .env file
        ↓
AWS SDK configured with credentials
        ↓
Express server starts
        ↓
CORS and security middleware applied
```

### AWS SDK Configuration

```
dotenv loads AWS credentials
        ↓
new AWS.S3() created with config
        ↓
All S3 operations use these credentials
        ↓
Signed URLs generated with same config
```

## 📈 Scalability Considerations

### Current Limitations

- Single server instance
- File list loads all at once
- No database for metadata
- Direct S3 operations

### Scaling Solutions

1. **Horizontal Scaling**: Load balancer + multiple servers
2. **Database**: Store file metadata in DynamoDB/RDS
3. **CDN**: CloudFront for static assets
4. **Caching**: Redis for frequent queries
5. **Serverless**: Lambda functions for API

## 🔄 Complete User Journey

### First-Time User

```
1. User visits website
2. Sees empty gallery with upload prompt
3. Clicks upload button
4. Drags & drops media files
5. Files upload with progress indication
6. Gallery refreshes showing uploaded files
7. User can click files to preview
8. User can search, filter, paginate
```

### Returning User

```
1. User visits website
2. Gallery loads with existing files
3. User can browse their media
4. Upload new files if needed
5. Search for specific files
6. Filter by file type
7. Download or delete files
```

This workflow documentation provides a complete understanding of how the S3 Media Gallery functions, from user interactions to backend processing and cloud storage operations.
