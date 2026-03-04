# Deployment Guide

This guide provides step-by-step instructions for deploying the S3 Media Gallery to various platforms.

## Quick Start (Local Development)

```bash
# Clone or navigate to project
cd S3-Project

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your AWS credentials
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_REGION=your_region
# S3_BUCKET_NAME=your_bucket

# Start development server
npm run dev
```

Visit `http://localhost:3000`

---

## Production Deployment Options

### Option 1: AWS EC2 (Recommended)

#### Prerequisites
- EC2 instance (t2.micro or larger)
- Node.js v14+
- Domain name (optional)

#### Steps

1. **Launch EC2 Instance**:
   ```bash
   # Connect to your EC2 instance
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

2. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and Setup**:
   ```bash
   git clone <your-repo-url>
   cd S3-Project
   npm install
   cp .env.example .env
   # Edit .env with production credentials
   ```

4. **Install PM2 for Process Management**:
   ```bash
   sudo npm install -g pm2
   ```

5. **Start Application**:
   ```bash
   pm2 start server/index.js --name "s3-gallery"
   pm2 startup
   pm2 save
   ```

6. **Setup Nginx (Optional but Recommended)**:
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/s3-gallery
   ```

   Nginx configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/s3-gallery /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Setup SSL with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

### Option 2: AWS Elastic Beanstalk

#### Steps

1. **Prepare Application**:
   ```bash
   # Create a .zip file excluding node_modules
   zip -r s3-gallery.zip . -x "node_modules/*" ".git/*"
   ```

2. **Create Elastic Beanstalk Application**:
   - Go to AWS Elastic Beanstalk console
   - Click "Create application"
   - Application name: `s3-media-gallery`
   - Platform: Node.js
   - Upload your ZIP file

3. **Configure Environment Variables**:
   In the Elastic Beanstalk console:
   - Go to Configuration → Software
   - Add environment variables:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_REGION`
     - `S3_BUCKET_NAME`
     - `NODE_ENV=production`

4. **Deploy**:
   - Click "Deploy" and wait for the environment to be ready
   - Your application will be available at the provided URL

---

### Option 3: Serverless (Lambda + API Gateway)

#### Architecture
- **Frontend**: S3 Static Website Hosting
- **Backend**: Lambda Functions
- **API**: API Gateway
- **CDN**: CloudFront

#### Steps

1. **Setup S3 Bucket for Frontend**:
   ```bash
   aws s3 mb s3://your-frontend-bucket
   aws s3 website s3://your-frontend-bucket --index-document index.html
   ```

2. **Build and Upload Frontend**:
   ```bash
   # Upload public folder to S3
   aws s3 sync public/ s3://your-frontend-bucket --delete
   aws s3api put-bucket-policy --bucket your-frontend-bucket --policy '{
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-frontend-bucket/*"
       }
     ]
   }'
   ```

3. **Convert Server to Lambda Functions**:
   Create `lambda-handler.js`:
   ```javascript
   const serverless = require('serverless-http');
   const app = require('./server/index.js');

   module.exports.handler = serverless(app);
   ```

4. **Install Serverless Dependencies**:
   ```bash
   npm install serverless-http
   ```

5. **Deploy with Serverless Framework**:
   Create `serverless.yml`:
   ```yaml
   service: s3-media-gallery-api
   provider:
     name: aws
     runtime: nodejs18.x
     region: us-east-1
   functions:
     app:
       handler: lambda-handler.handler
       events:
         - http:
             path: /{proxy+}
             method: ANY
         - http:
             path: /
             method: ANY
   ```

   ```bash
   npm install -g serverless
   serverless deploy
   ```

6. **Update Frontend API URL**:
   Update `public/script.js` to use your API Gateway URL

7. **Setup CloudFront**:
   - Create CloudFront distribution
   - Origin: S3 bucket for frontend
   - Custom domain: API Gateway for backend

---

### Option 4: Docker Deployment

#### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
    restart: unless-stopped
```

#### Deploy with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Environment Configuration

### Production Environment Variables

Create `.env.production`:

```env
NODE_ENV=production
PORT=3000
AWS_ACCESS_KEY_ID=your_production_key
AWS_SECRET_ACCESS_KEY=your_production_secret
AWS_REGION=your_region
S3_BUCKET_NAME=your_production_bucket
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Security Best Practices

1. **Use IAM Roles** instead of access keys when possible
2. **Enable VPC** for Lambda functions
3. **Use HTTPS** with SSL certificates
4. **Set up CloudWatch** for monitoring
5. **Enable AWS CloudTrail** for audit logging
6. **Use WAF** for additional protection

---

## Monitoring and Maintenance

### Health Checks

```bash
# Check application health
curl https://your-domain.com/api/health

# Monitor PM2 processes
pm2 status
pm2 logs

# Check EC2 status
sudo systemctl status nginx
```

### Log Management

```bash
# PM2 logs
pm2 logs s3-gallery

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx
```

### Backup Strategy

1. **S3 Versioning**: Enable on your media bucket
2. **Database Backup**: Not applicable for this app
3. **Code Backup**: Use Git with proper branching
4. **Configuration Backup**: Save environment variables securely

---

## Performance Optimization

### CDN Setup

1. **CloudFront Distribution**:
   - Origin: Your S3 bucket or EC2 instance
   - Cache behavior: Static assets for 1 year
   - Compress: Enable gzip compression

2. **Browser Caching**:
   Add to `server/index.js`:
   ```javascript
   app.use(express.static(path.join(__dirname, '../public'), {
     maxAge: '1y',
     etag: true
   }));
   ```

### Database Optimization

Not applicable as this uses S3 directly.

### Scaling

1. **Horizontal Scaling**: Load balancer + multiple EC2 instances
2. **Vertical Scaling**: Larger EC2 instance types
3. **Serverless**: Auto-scaling with Lambda

---

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   ```bash
   # Check CORS origin in environment variables
   echo $CORS_ORIGIN
   ```

2. **S3 Access Denied**:
   ```bash
   # Test S3 access
   aws s3 ls s3://your-bucket
   ```

3. **High Memory Usage**:
   ```bash
   # Check PM2 memory usage
   pm2 monit
   ```

4. **Slow Loading**:
   - Enable CloudFront CDN
   - Optimize images
   - Use pagination

### Debug Mode

Set environment variable for debugging:
```bash
NODE_ENV=development npm start
```

---

## Cost Optimization

### AWS Cost Tips

1. **S3 Storage**: Use S3 Intelligent-Tiering
2. **Data Transfer**: Use CloudFront to reduce costs
3. **Compute**: Use right-sized EC2 instances
4. **Lambda**: Optimize memory and duration

### Monitoring Costs

Set up AWS Budgets to track spending:
- S3 storage costs
- Data transfer costs
- Compute costs

---

This deployment guide covers the most common deployment scenarios. Choose the option that best fits your requirements, budget, and technical expertise.
