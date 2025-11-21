# Installing Google Cloud SDK on Windows

## Option 1: Using the Installer (Recommended)

1. **Download the installer**:
   - Go to: https://cloud.google.com/sdk/docs/install
   - Or direct download: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

2. **Run the installer**:
   - Double-click `GoogleCloudSDKInstaller.exe`
   - Follow the installation wizard
   - Make sure "Add to PATH" is checked

3. **Restart your terminal** (PowerShell/CMD) after installation

4. **Verify installation**:
   ```bash
   gcloud --version
   ```

## Option 2: Using PowerShell (Quick Install)

Open PowerShell as Administrator and run:

```powershell
# Download installer
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:TEMP\GoogleCloudSDKInstaller.exe")

# Run installer
& $env:TEMP\GoogleCloudSDKInstaller.exe
```

## Option 3: Using Chocolatey (If you have it)

```powershell
choco install gcloudsdk
```

## Option 4: Using Scoop (If you have it)

```powershell
scoop install gcloud
```

## After Installation

1. **Restart your terminal** (close and reopen PowerShell/CMD)

2. **Initialize gcloud**:
   ```bash
   gcloud init
   ```

3. **Login**:
   ```bash
   gcloud auth login
   ```

4. **Set your project** (if you have one):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

## Troubleshooting

### If `gcloud` still not found after installation:

1. **Check if it's in PATH**:
   ```powershell
   $env:PATH -split ';' | Select-String "google"
   ```

2. **Manually add to PATH**:
   - Usually installed at: `C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin`
   - Or: `C:\Users\YOUR_USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`
   - Add this path to your System Environment Variables

3. **Restart terminal** after adding to PATH

### Verify Installation

```bash
gcloud --version
```

You should see something like:
```
Google Cloud SDK 450.0.0
```

## Next Steps

Once installed, follow the deployment guide in `DEPLOYMENT-GCP.md`:

```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Continue with deployment...
```

