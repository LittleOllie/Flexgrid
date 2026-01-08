# GitHub Push Authentication Fix

## 🔐 Issue

**Error:** `Permission denied to brettearl18`  
**Cause:** You're authenticated as `brettearl18` but pushing to `LittleOllie` repository

## ✅ Solutions

### Option 1: Use Personal Access Token (Recommended)

1. **Create Token on GitHub**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name it: "Flex Grid Push"
   - Select scopes: `repo` (full control)
   - Generate and copy token

2. **Push with Token**
   ```bash
   cd flex-grid
   git push -u origin main
   # When prompted:
   # Username: LittleOllie (or your username)
   # Password: [paste token here]
   ```

### Option 2: Use SSH (If You Have SSH Key)

1. **Change Remote to SSH**
   ```bash
   cd flex-grid
   git remote set-url origin git@github.com:LittleOllie/Flexgrid.git
   git push -u origin main
   ```

### Option 3: Use GitHub CLI

```bash
gh auth login
cd flex-grid
git push -u origin main
```

### Option 4: Switch Git User

If you have access to LittleOllie account:

```bash
git config user.name "LittleOllie"
git config user.email "your-email@example.com"
git push -u origin main
```

---

## 🚀 Quick Fix (Try This First)

```bash
cd flex-grid

# Try pushing - it will prompt for credentials
git push -u origin main

# If it asks for username/password:
# Username: LittleOllie
# Password: [use personal access token, not password]
```

---

## 📝 Personal Access Token Steps

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Name: "Flex Grid"
4. Expiration: 90 days (or your choice)
5. Scopes: Check `repo`
6. Generate
7. Copy token (you won't see it again!)
8. Use as password when pushing

---

**Note:** You can't use your GitHub password - must use a personal access token for HTTPS.

