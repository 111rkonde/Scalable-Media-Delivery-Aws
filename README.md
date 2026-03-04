# S3 Media Gallery

A secure, modern media gallery website that connects to Amazon S3 for storing and viewing media files. Features include file upload, search, filtering, and responsive design.

## Features

- **Secure S3 Integration**: Private bucket with signed URLs
- **Media Support**: Images, videos, and audio files
- **File Upload**: Drag & drop or browse to upload files
- **Search & Filter**: Search by filename and filter by file type
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, gradient-based design with smooth animations
- **Pagination**: Handle large numbers of files efficiently
- **File Management**: Preview, download, and delete files
- **Security**: Rate limiting, CORS protection, and secure file access

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Cloud**: Amazon S3
- **Security**: Helmet.js, CORS, Rate limiting

## Project Structure

```
S3-Project/
├── server/
│   └── index.js              # Express server with AWS SDK
├── public/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # Complete styling
│   └── script.js             # Frontend JavaScript
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore file
├── iam-policy.json           # IAM policy for AWS
└── README.md                 # This file
```

## Setup Instructions

### 1. Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- AWS Account with S3 bucket

### 2. AWS Setup

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-bucket-name-here --region your-region
   ```

2. **Set Bucket to Private**:
   ```bash
   aws s3api put-bucket-acl --bucket your-bucket-name-here --acl private
   ```

3. **Create IAM User**:
   - Go to AWS IAM console
   - Create new user with "Programmatic access"
   - Attach the policy from `iam-policy.json`
   - Save the Access Key ID and Secret Access Key

### 3. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```env
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=ap-south-1
   S3_BUCKET_NAME=your-bucket-name-here
   PORT=3000
   NODE_ENV=development
   ```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

**Development**:
```bash
npm run dev
```

**Production**:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Files
- `GET /api/files` - List all files with pagination and filtering
- `GET /api/files/:key/info` - Get file information
- `DELETE /api/files/:key` - Delete a file

### Upload
- `POST /api/upload` - Direct file upload (for files up to 50MB)
- `POST /api/upload-url` - Get pre-signed upload URL

### Utility
- `GET /api/health` - Health check endpoint

## Query Parameters

### GET /api/files

- `page` (number): Page number (default: 1)
- `limit` (number): Files per page (default: 50)
- `type` (string): Filter by type - 'image', 'video', 'audio', 'all' (default: 'all')
- `search` (string): Search query for filenames
- `prefix` (string): S3 prefix for folder filtering

## Security Features

- **Private S3 Bucket**: Files are not publicly accessible
- **Signed URLs**: Temporary URLs for secure file access
- **Rate Limiting**: Prevents abuse of API endpoints
- **CORS Protection**: Controls cross-origin requests
- **Helmet.js**: Security headers for Express
- **File Size Limits**: 50MB maximum file size
- **Input Validation**: Validates all user inputs

## Supported File Types

### Images
- JPG, JPEG, PNG, GIF, BMP, WebP, SVG

### Videos
- MP4, AVI, MOV, WMV, FLV, WebM, MKV

### Audio
- MP3, WAV, OGG, FLAC, AAC, M4A

## Deployment Options

### Option 1: EC2 Deployment

1. Launch an EC2 instance (t2.micro or larger)
2. Install Node.js and npm
3. Clone the repository
4. Install dependencies
5. Configure environment variables
6. Run with PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name "s3-gallery"
   pm2 startup
   pm2 save
   ```

### Option 2: Elastic Beanstalk

1. Create a new Elastic Beanstalk application
2. Choose Node.js platform
3. Upload your code as a ZIP file
4. Configure environment variables in the EB console
5. Deploy

### Option 3: Serverless (Lambda + API Gateway)

For a serverless approach, you can:
1. Convert the Express app to Lambda functions
2. Use API Gateway for HTTP endpoints
3. Host the frontend on S3 static hosting
4. Set up CloudFront for CDN

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes |
| `AWS_REGION` | AWS region | Yes |
| `S3_BUCKET_NAME` | S3 bucket name | Yes |
| `PORT` | Server port | No (default: 3000) |
| `NODE_ENV` | Environment | No (default: development) |
| `CORS_ORIGIN` | CORS origin | No (default: localhost:3000) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | No (default: 15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | No (default: 100) |

## IAM Policy

Use the provided `iam-policy.json` file for the IAM user. Replace `your-bucket-name-here` with your actual bucket name.

## Monitoring and Logging

- Server logs are printed to console
- Use PM2 logs for production monitoring:
  ```bash
  pm2 logs s3-gallery
  ```
- Monitor S3 API calls through AWS CloudTrail

## Performance Optimization

- **Pagination**: Limits files loaded per page
- **Lazy Loading**: Images load as needed
- **CDN**: Use CloudFront for better performance
- **Caching**: Browser caching for static assets
- **Compression**: Enable gzip compression

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check CORS_ORIGIN in environment variables
2. **Access Denied**: Verify IAM permissions and bucket policy
3. **Upload Failures**: Check file size limits and S3 permissions
4. **Slow Loading**: Consider pagination and CDN

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and stack traces.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS S3 documentation
3. Create an issue in the repository

---

**Note**: Always keep your AWS credentials secure and never commit them to version control. Use environment variables or AWS IAM roles for production deployments.
