# Google Cloud Platform Deployment Guide

This guide covers deploying HouseHunter to Google Cloud Platform (GCP).

## 🚀 Recommended: Cloud Run (Serverless Containers)

**Cloud Run** is the best option - it's serverless, scales automatically, and has a generous free tier.

### Prerequisites

1. **Install Google Cloud SDK**:
   ```bash
   # Windows (PowerShell)
   (New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
   & $env:Temp\GoogleCloudSDKInstaller.exe
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Initialize and login**:
   ```bash
   gcloud init
   gcloud auth login
   ```

3. **Enable required APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

### Step 1: Build and Push Docker Images

#### Backend

```bash
# Set your project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Build and push backend image
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/househunter-backend

# Or use Docker directly
docker build -t gcr.io/$PROJECT_ID/househunter-backend .
docker push gcr.io/$PROJECT_ID/househunter-backend
```

#### Frontend

```bash
cd frontend

# Build with API URL
docker build --build-arg VITE_API_URL=https://your-backend-url.run.app -t gcr.io/$PROJECT_ID/househunter-frontend .

# Push to GCR
docker push gcr.io/$PROJECT_ID/househunter-frontend
```

### Step 2: Deploy Backend to Cloud Run

```bash
gcloud run deploy househunter-backend \
  --image gcr.io/$PROJECT_ID/househunter-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "DATABASE_URL=file:./data/dev.db" \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "PORT=8080" \
  --set-secrets "TELEGRAM_BOT_TOKEN=telegram-bot-token:latest" \
  --set-secrets "OLX_CLIENT_ID=olx-client-id:latest" \
  --set-secrets "OLX_CLIENT_SECRET=olx-client-secret:latest" \
  --set-secrets "OLX_ACCESS_TOKEN=olx-access-token:latest" \
  --set-secrets "SESSION_SECRET=session-secret:latest"
```

**Note**: Get your backend URL from the output, you'll need it for the frontend.

### Step 3: Store Secrets in Secret Manager

```bash
# Create secrets
echo -n "your-telegram-token" | gcloud secrets create telegram-bot-token --data-file=-
echo -n "your-olx-client-id" | gcloud secrets create olx-client-id --data-file=-
echo -n "your-olx-client-secret" | gcloud secrets create olx-client-secret --data-file=-
echo -n "your-olx-access-token" | gcloud secrets create olx-access-token --data-file=-
echo -n "your-random-session-secret" | gcloud secrets create session-secret --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding telegram-bot-token \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# Repeat for other secrets
```

### Step 4: Deploy Frontend to Cloud Run

```bash
# Update FRONTEND_URL with your backend URL
gcloud run deploy househunter-frontend \
  --image gcr.io/$PROJECT_ID/househunter-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --port 80
```

### Step 5: Update CORS and Environment Variables

After deployment, update the backend's `FRONTEND_URL`:

```bash
gcloud run services update househunter-backend \
  --region us-central1 \
  --update-env-vars "FRONTEND_URL=https://househunter-frontend-xxxxx.run.app"
```

---

## 📦 Alternative: App Engine (PaaS)

### Step 1: Create app.yaml for Backend

Create `backend/app.yaml`:

```yaml
runtime: nodejs20

env_variables:
  NODE_ENV: production
  DATABASE_URL: file:./data/dev.db
  PORT: 8080

# Use secrets from Secret Manager
env:
  standard:
    instance_class: F1
    automatic_scaling:
      min_instances: 0
      max_instances: 10
```

### Step 2: Deploy Backend

```bash
cd backend
gcloud app deploy app.yaml
```

### Step 3: Deploy Frontend

Create `frontend/app.yaml`:

```yaml
runtime: nodejs20

handlers:
  - url: /.*
    static_files: dist/index.html
    upload: dist/index.html
  - url: /(.*)
    static_files: dist/\1
    upload: dist/(.*)
```

```bash
cd frontend
npm run build
gcloud app deploy app.yaml
```

---

## 🖥️ Alternative: Compute Engine (VMs)

### Step 1: Create VM Instance

```bash
gcloud compute instances create househunter-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=20GB
```

### Step 2: Install Docker and Deploy

```bash
# SSH into VM
gcloud compute ssh househunter-vm --zone=us-central1-a

# Install Docker (on Container-Optimized OS, Docker is pre-installed)
# Or use standard Debian/Ubuntu image and install Docker

# Clone your repo or copy files
git clone your-repo
cd houseHunter

# Run with docker-compose
docker-compose up -d
```

---

## 💾 Database Considerations

### Option 1: SQLite (Current - Simple but Limited)

SQLite works but has limitations:
- No concurrent writes
- File storage (needs persistent disk)
- Not ideal for multiple instances

**For Cloud Run with SQLite:**
- Use Cloud Storage FUSE to mount a bucket as a filesystem
- Or use a persistent volume (Cloud Run supports this)

### Option 2: Cloud SQL (Recommended for Production)

Migrate to PostgreSQL:

1. **Create Cloud SQL instance**:
   ```bash
   gcloud sql instances create househunter-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1
   ```

2. **Create database**:
   ```bash
   gcloud sql databases create househunter --instance=househunter-db
   ```

3. **Update Prisma schema** to use PostgreSQL
4. **Update DATABASE_URL**:
   ```
   DATABASE_URL=postgresql://user:password@/househunter?host=/cloudsql/PROJECT_ID:REGION:househunter-db
   ```

---

## 🔧 Configuration Files

### cloudbuild.yaml (CI/CD)

Create `.cloudbuild.yaml` in project root:

```yaml
steps:
  # Build backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/househunter-backend', './backend']
  
  # Push backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/househunter-backend']
  
  # Build frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '--build-arg', 'VITE_API_URL=https://househunter-backend-xxx.run.app', '-t', 'gcr.io/$PROJECT_ID/househunter-frontend', './frontend']
  
  # Push frontend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/househunter-frontend']
  
  # Deploy backend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'househunter-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/househunter-backend'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
  
  # Deploy frontend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'househunter-frontend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/househunter-frontend'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/househunter-backend'
  - 'gcr.io/$PROJECT_ID/househunter-frontend'
```

Trigger build:
```bash
gcloud builds submit --config .cloudbuild.yaml
```

---

## 💰 Cost Estimation

### Cloud Run (Free Tier)
- **Free**: 2 million requests/month, 360,000 GB-seconds, 180,000 vCPU-seconds
- **After free tier**: ~$0.40 per million requests, $0.0000025 per GB-second

### Cloud SQL (db-f1-micro)
- **Free tier**: None
- **Cost**: ~$7.67/month (always-on instance)

### Total Estimated Cost
- **With free tier**: $0-10/month (mostly free)
- **After free tier**: ~$10-20/month for small usage

---

## 🔐 Security Best Practices

1. **Use Secret Manager** for all sensitive data (already configured)
2. **Enable Cloud Armor** for DDoS protection
3. **Use IAM** to restrict access
4. **Enable VPC** for private networking (if needed)
5. **Use HTTPS only** (Cloud Run provides this automatically)

---

## 📝 Quick Start Commands

```bash
# 1. Set project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# 3. Build and deploy backend
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/househunter-backend
gcloud run deploy househunter-backend \
  --image gcr.io/YOUR_PROJECT_ID/househunter-backend \
  --region us-central1 \
  --allow-unauthenticated

# 4. Note the backend URL, then build frontend with it
cd ../frontend
docker build --build-arg VITE_API_URL=https://YOUR_BACKEND_URL \
  -t gcr.io/YOUR_PROJECT_ID/househunter-frontend .
docker push gcr.io/YOUR_PROJECT_ID/househunter-frontend

# 5. Deploy frontend
gcloud run deploy househunter-frontend \
  --image gcr.io/YOUR_PROJECT_ID/househunter-frontend \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🐛 Troubleshooting

### Database locked errors
- Use Cloud SQL PostgreSQL instead of SQLite
- Or ensure only one instance is running

### CORS errors
- Update `FRONTEND_URL` environment variable in Cloud Run
- Check CORS configuration in `backend/src/index.ts`

### Session not persisting
- Ensure cookies are set correctly
- Check that `credentials: true` is set in frontend API calls
- Verify session secret is set

### Build failures
- Check Cloud Build logs: `gcloud builds list`
- Verify Dockerfile syntax
- Ensure all dependencies are in package.json

---

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud SQL](https://cloud.google.com/sql/docs)

