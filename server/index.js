const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Helper function to determine file type
function getFileType(key) {
  const ext = path.extname(key).toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'other';
}

// API Routes

// Get all files from S3 bucket
app.get('/api/files', async (req, res) => {
  try {
    const { type = 'all', search = '', page = 1, limit = 50 } = req.query;
    
    const params = {
      Bucket: BUCKET_NAME,
      MaxKeys: 1000
    };

    const data = await s3.listObjectsV2(params).promise();
    
    let files = data.Contents || [];
    
    // Filter by type
    if (type !== 'all') {
      files = files.filter(file => getFileType(file.Key) === type);
    }
    
    // Search functionality
    if (search) {
      files = files.filter(file => 
        file.Key.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Add file metadata
    const filesWithMetadata = files.map(file => ({
      key: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
      type: getFileType(file.Key),
      extension: path.extname(file.Key).toLowerCase()
    }));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedFiles = filesWithMetadata.slice(startIndex, endIndex);
    
    // Return files without URLs for faster loading
    res.json({
      files: paginatedFiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filesWithMetadata.length / limit),
        totalFiles: filesWithMetadata.length,
        hasNext: endIndex < filesWithMetadata.length,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files from S3' });
  }
});

// Generate pre-signed upload URL
app.post('/api/upload-url', async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'File name and type are required' });
    }
    
    // Validate file size (5GB limit)
    if (fileSize && fileSize > 5 * 1024 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 5GB limit' });
    }
    
    // Generate unique key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const key = `uploads/${timestamp}-${randomString}-${fileName}`;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 60, // 1 minute
      ContentType: fileType,
      ACL: 'private'
    };
    
    const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
    
    res.json({
      uploadUrl,
      key,
      expiresIn: 60
    });
    
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Direct file upload endpoint (for smaller files)
app.post('/api/upload', multer({ 
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB
  storage: multer.memoryStorage()
}).single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { originalname, buffer, mimetype, size } = req.file;
    
    // Generate unique key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const key = `uploads/${timestamp}-${randomString}-${originalname}`;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'private'
    };
    
    const result = await s3.upload(params).promise();
    
    res.json({
      message: 'File uploaded successfully',
      key: result.Key,
      location: result.Location,
      size: size,
      type: getFileType(key)
    });
    
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Delete file
app.delete('/api/files/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    
    res.json({ message: 'File deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get signed URL for a specific file
app.get('/api/files/:key/url', async (req, res) => {
  try {
    const { key } = req.params;
    
    const urlParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 3600 // 1 hour
    };
    
    const signedUrl = await s3.getSignedUrlPromise('getObject', urlParams);
    
    res.json({
      key: key,
      url: signedUrl
    });
    
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Get file info
app.get('/api/files/:key/info', async (req, res) => {
  try {
    const { key } = req.params;
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    const data = await s3.headObject(params).promise();
    
    res.json({
      key: key,
      size: data.ContentLength,
      lastModified: data.LastModified,
      contentType: data.ContentType,
      type: getFileType(key),
      extension: path.extname(key).toLowerCase()
    });
    
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend for all routes
app.get('*', (req, res) => {
  // For the root path, serve the main app
  if (req.path === '/') {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    // For other paths, try to serve static files first
    res.sendFile(path.join(__dirname, '../public', req.path), (err) => {
      if (err) {
        // If file not found, serve main app (for client-side routing)
        res.sendFile(path.join(__dirname, '../public/index.html'));
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
