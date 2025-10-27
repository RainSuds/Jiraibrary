# AWS Deployment Guide for Jiraibrary

This guide provides step-by-step instructions for deploying Jiraibrary to AWS.

## Architecture Overview

- **Frontend**: React SPA hosted on AWS S3 + CloudFront
- **Backend**: Node.js API on AWS Elastic Beanstalk or EC2
- **Database**: Amazon RDS (PostgreSQL) or continue with SQLite for simplicity
- **Images**: Amazon S3 bucket for product images

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Node.js 18+ installed locally
- Git repository access

## Option 1: Simple Deployment (SQLite + EC2)

This is the quickest way to get started with minimal changes.

### Step 1: Deploy Backend to EC2

1. **Launch EC2 Instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t2.micro (free tier eligible)
   - Security Group: Allow HTTP (80), HTTPS (443), SSH (22), and custom TCP (3001)

2. **Connect to EC2 and Setup**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install git
   sudo apt-get install -y git
   
   # Clone repository
   git clone https://github.com/RainSuds/Jiraibrary.git
   cd Jiraibrary/backend
   
   # Install dependencies
   npm install
   
   # Initialize database
   npm run init-db
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Start the backend
   pm2 start server.js --name jiraibrary-api
   pm2 startup
   pm2 save
   ```

3. **Configure Environment**
   ```bash
   # Edit backend/.env
   PORT=3001
   NODE_ENV=production
   ```

### Step 2: Build and Deploy Frontend to S3

1. **Build Frontend**
   ```bash
   # On your local machine
   cd frontend
   
   # Update API URL in vite.config.js
   # Change proxy target to your EC2 public IP
   
   # Build
   npm run build
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://jiraibrary-frontend
   ```

3. **Configure S3 for Static Website Hosting**
   ```bash
   aws s3 website s3://jiraibrary-frontend \
     --index-document index.html \
     --error-document index.html
   ```

4. **Upload Build Files**
   ```bash
   aws s3 sync dist/ s3://jiraibrary-frontend --acl public-read
   ```

5. **Set Bucket Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::jiraibrary-frontend/*"
       }
     ]
   }
   ```

### Step 3: Setup CloudFront (Optional but Recommended)

1. Create CloudFront distribution pointing to S3 bucket
2. Configure custom domain (optional)
3. Enable HTTPS with ACM certificate

## Option 2: Production Deployment (RDS + Elastic Beanstalk)

### Step 1: Migrate to PostgreSQL

1. **Install PostgreSQL Driver**
   ```bash
   cd backend
   npm install pg
   ```

2. **Update database.js**
   Replace better-sqlite3 with pg and update queries for PostgreSQL compatibility.

3. **Create RDS Instance**
   - Database: PostgreSQL 15
   - Instance: db.t3.micro
   - Enable public access (or use VPC)

### Step 2: Deploy to Elastic Beanstalk

1. **Initialize Elastic Beanstalk**
   ```bash
   cd backend
   eb init -p node.js-18 jiraibrary-api
   ```

2. **Create Environment**
   ```bash
   eb create jiraibrary-prod
   ```

3. **Set Environment Variables**
   ```bash
   eb setenv DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/jiraibrary
   eb setenv NODE_ENV=production
   ```

4. **Deploy**
   ```bash
   eb deploy
   ```

### Step 3: Configure Image Storage with S3

1. **Create S3 Bucket for Images**
   ```bash
   aws s3 mb s3://jiraibrary-images
   ```

2. **Update Backend to Use S3**
   - Install AWS SDK: `npm install @aws-sdk/client-s3`
   - Update upload endpoint in server.js to upload to S3
   - Set appropriate CORS policies

3. **Configure IAM Role**
   - Attach policy to EC2/EB role for S3 access

## Environment Variables Reference

### Backend (.env)
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # For PostgreSQL
AWS_REGION=us-east-1
AWS_S3_BUCKET=jiraibrary-images
```

### Frontend (vite.config.js)
Update the proxy target to point to your production backend URL.

## Post-Deployment Checklist

- [ ] Backend API is accessible and returning data
- [ ] Frontend can connect to backend API
- [ ] Image uploads work correctly
- [ ] Database is properly initialized with sample data
- [ ] HTTPS is configured (CloudFront/Load Balancer)
- [ ] CORS is properly configured
- [ ] Error logging is set up (CloudWatch)
- [ ] Backups are configured (RDS automated backups)
- [ ] Monitoring is enabled (CloudWatch)

## Scaling Considerations

1. **Auto Scaling**: Configure Elastic Beanstalk auto-scaling based on CPU/memory
2. **CDN**: Use CloudFront for global content delivery
3. **Database**: Consider Aurora Serverless for automatic scaling
4. **Caching**: Implement Redis/ElastiCache for API response caching
5. **Load Balancing**: Elastic Beanstalk includes ALB automatically

## Cost Optimization

- Use AWS Free Tier when possible
- Consider Reserved Instances for consistent workloads
- Use S3 Intelligent-Tiering for images
- Enable CloudFront request compression
- Monitor usage with AWS Cost Explorer

## Troubleshooting

### Backend Not Starting
- Check PM2 logs: `pm2 logs jiraibrary-api`
- Check EC2 security groups
- Verify Node.js version

### Frontend Can't Connect to Backend
- Check CORS configuration in server.js
- Verify API URL in frontend build
- Check security groups allow traffic on port 3001

### Database Connection Issues
- Verify RDS security group allows connections
- Check DATABASE_URL format
- Ensure RDS is publicly accessible (if needed)

## Support

For issues, please open a GitHub issue or refer to AWS documentation.
