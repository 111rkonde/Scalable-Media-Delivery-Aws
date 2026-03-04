const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const SimpleAuth = require('./simple-auth');
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const result = SimpleAuth.register(username, email, password);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    const token = SimpleAuth.createSession(result.user);
    res.json({ 
      message: 'User registered successfully', 
      token,
      user: result.user 
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = SimpleAuth.login(email, password);
    
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    
    res.json({ 
      message: 'Login successful', 
      token: result.token,
      user: result.user 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', SimpleAuth.authenticate, (req, res) => {
  const user = SimpleAuth.getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// API Routes

// Get all files from S3 bucket (user-specific)
app.get('/api/files', SimpleAuth.authenticate, async (req, res) => {
  try {
    const { type = 'all', search = '', page = 1, limit = 50 } = req.query;
    const userPrefix = `users/${req.user.userId}/`;
    
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: userPrefix,
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
      extension: path.extname(file.Key).toLowerCase(),
      // Remove user prefix for display
      displayName: file.Key.replace(userPrefix, '')
    }));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedFiles = filesWithMetadata.slice(startIndex, endIndex);
    
    // Generate signed URLs for each file
    const filesWithUrls = await Promise.all(
      paginatedFiles.map(async (file) => {
        const urlParams = {
          Bucket: BUCKET_NAME,
          Key: file.key,
          Expires: 3600 // 1 hour
        };
        
        const signedUrl = await s3.getSignedUrlPromise('getObject', urlParams);
        
        return {
          ...file,
          url: signedUrl
        };
      })
    );
    
    res.json({
      files: filesWithUrls,
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

// Generate pre-signed upload URL (user-specific)
app.post('/api/upload-url', SimpleAuth.authenticate, async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    
    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'File name and type are required' });
    }
    
    // Validate file size (50MB limit)
    if (fileSize && fileSize > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 50MB limit' });
    }
    
    // Generate unique key with user prefix
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const key = `users/${req.user.userId}/${timestamp}-${randomString}-${fileName}`;
    
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

// Direct file upload endpoint (for smaller files, user-specific)
app.post('/api/upload', SimpleAuth.authenticate, multer({ 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  storage: multer.memoryStorage()
}).single('file'), async (req, res) => {
  try {
    console.log('Upload request received:', {
      user: req.user,
      file: req.file ? req.file.originalname : 'No file',
      size: req.file ? req.file.size : 0
    });

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { originalname, buffer, mimetype, size } = req.file;
    
    // Generate unique key with user prefix
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const key = `users/${req.user.userId}/${timestamp}-${randomString}-${originalname}`;
    
    console.log('Uploading to S3:', { key, size, mimetype });
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'private'
    };
    
    const result = await s3.upload(params).promise();
    console.log('S3 upload successful:', result.Location);
    
    res.json({
      message: 'File uploaded successfully',
      key: result.Key,
      location: result.Location,
      size: size,
      type: getFileType(key),
      displayName: originalname
    });
    
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file: ' + error.message });
  }
});

// Delete file (user-specific)
app.delete('/api/files/:key', SimpleAuth.authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Ensure user can only delete their own files
    const userPrefix = `users/${req.user.userId}/`;
    if (!key.startsWith(userPrefix)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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

// Get file info (user-specific)
app.get('/api/files/:key/info', SimpleAuth.authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Ensure user can only access their own files
    const userPrefix = `users/${req.user.userId}/`;
    if (!key.startsWith(userPrefix)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
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
      extension: path.extname(key).toLowerCase(),
      displayName: key.replace(userPrefix, '')
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

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Serve frontend for all other routes (protected)
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
