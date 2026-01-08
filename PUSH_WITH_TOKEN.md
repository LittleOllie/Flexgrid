# Push to GitHub with Personal Access Token

## 🔑 Step-by-Step Instructions

### Step 1: Create Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in:
   - **Note:** `Flex Grid Push`
   - **Expiration:** 90 days (or your choice)
   - **Scopes:** Check ✅ `repo` (this gives full repository access)
4. Click **"Generate token"**
5. **COPY THE TOKEN** (you won't see it again!)

### Step 2: Push with Token

**Option A: Interactive (Recommended)**

```bash
cd flex-grid
git push -u origin main
```

When prompted:
- **Username:** `LittleOllie`
- **Password:** `[paste your token here]` ← Use token, NOT password!

**Option B: Embed Token in URL (One-time)**

```bash
cd flex-grid

# Replace YOUR_TOKEN with your actual token
git remote set-url origin https://YOUR_TOKEN@github.com/LittleOllie/Flexgrid.git

# Push (won't prompt for credentials)
git push -u origin main

# After pushing, remove token from URL for security
git remote set-url origin https://github.com/LittleOllie/Flexgrid.git
```

**Option C: Use Git Credential Helper**

```bash
cd flex-grid

# This will prompt for credentials and save them
git push -u origin main

# Enter:
# Username: LittleOllie
# Password: [your token]
```

---

## 🚨 Important Notes

- **Never commit tokens to git!**
- **Tokens are like passwords** - keep them secret
- **Use token as password**, not your GitHub password
- GitHub doesn't accept passwords for HTTPS anymore

---

## ✅ After Successful Push

Your repository will be live at:
**https://github.com/LittleOllie/Flexgrid**

You can verify by visiting the URL!

---

## 🆘 Troubleshooting

**Still getting 403?**
- Make sure token has `repo` scope
- Make sure you're using token as password (not GitHub password)
- Try clearing credentials: `git credential-osxkeychain erase` (then enter host=github.com)

**Token expired?**
- Generate a new token
- Use new token as password

---

**Ready to push!** Get your token from GitHub and use it as the password when prompted.

