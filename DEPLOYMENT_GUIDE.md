# Vercel Deployment Troubleshooting Guide

## 🚨 Common Deployment Issues & Solutions

### 1. **Next.js Canary Version Issues**
**Problem**: Using Next.js 16.0.1-canary.2 can cause deployment instability.

**Solution**:
```bash
# Downgrade to stable version
npm install next@15.1.0
# or
pnpm add next@15.1.0
```

### 2. **Database Migration Failures**
**Problem**: Build fails when migrations run during build process.

**Solutions**:
- **Option A**: Run migrations separately before deployment
  ```bash
  pnpm db:migrate
  pnpm build
  ```

- **Option B**: Use Vercel's build command override
  - In Vercel dashboard → Project Settings → Build & Development Settings
  - Override Build Command: `pnpm build:migrate`

- **Option C**: Use the safer build script (already implemented)
  ```bash
  pnpm build  # Safe build without migrations
  ```

### 3. **Missing Environment Variables**
**Problem**: Application fails due to missing environment variables.

**Required Variables**:
```bash
# Essential
POSTGRES_URL=postgresql://...
AUTH_SECRET=your_secret_here

# Optional but recommended
REDIS_URL=redis://...
BLOB_READ_WRITE_TOKEN=your_token

# CEREBRO System (optional)
CEREBRO_TOKEN_BUDGET_TOTAL=2000
CEREBRO_TOKEN_BUDGET_MODEL_RESERVE=512
```

**Setup**:
1. Copy `.env.example` to `.env.local`
2. Fill in your values
3. In Vercel: Project Settings → Environment Variables
4. Add all required variables

### 4. **AI Gateway Credit Card Error**
**Problem**: "AI Gateway requires a valid credit card on file"

**Solution**:
- Visit: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card
- Add a credit card to unlock free credits
- Or use direct provider APIs instead of AI Gateway

### 5. **CEREBRO System Complexity**
**Problem**: Complex memory system causing deployment issues.

**Solutions**:
- **Minimal Setup**: Deploy without CEREBRO features first
- **Gradual Rollout**: Enable CEREBRO features after basic deployment works
- **Environment**: Ensure all CEREBRO env vars are set

## 🔧 **Step-by-Step Deployment Process**

### **Pre-Deployment Checklist**
- [ ] Environment variables configured in Vercel
- [ ] Database (Neon Postgres) created and accessible
- [ ] Redis instance (Upstash) created (optional)
- [ ] Vercel Blob storage configured
- [ ] GitHub repository connected to Vercel

### **Deployment Steps**

1. **Prepare Environment**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Link project
   vercel link
   
   # Pull environment variables
   vercel env pull
   ```

2. **Test Locally**:
   ```bash
   # Install dependencies
   pnpm install
   
   # Run migrations
   pnpm db:migrate
   
   # Test build
   pnpm build
   
   # Test locally
   pnpm dev
   ```

3. **Deploy to Vercel**:
   ```bash
   # Deploy
   vercel --prod
   
   # Or push to main branch (if auto-deploy enabled)
   git push origin main
   ```

4. **Post-Deployment**:
   ```bash
   # Run migrations on production
   vercel env pull .env.production
   POSTGRES_URL=$(grep POSTGRES_URL .env.production | cut -d '=' -f2)
   pnpm db:migrate
   ```

## 🚀 **Optimized Deployment Configuration**

### **Vercel Project Settings**

**Build & Development Settings**:
- Framework Preset: `Next.js`
- Build Command: `pnpm build` (or `pnpm build:migrate` if migrations needed)
- Output Directory: `.next`
- Install Command: `pnpm install`

**Environment Variables**:
```bash
# Database
POSTGRES_URL=postgresql://...

# Authentication
AUTH_SECRET=your_secret_here
AUTH_GITHUB_ID=your_github_id
AUTH_GITHUB_SECRET=your_github_secret

# Storage
BLOB_READ_WRITE_TOKEN=your_blob_token

# Optional: Redis for CEREBRO
REDIS_URL=redis://...

# Optional: CEREBRO Configuration
CEREBRO_TOKEN_BUDGET_TOTAL=2000
CEREBRO_TOKEN_BUDGET_MODEL_RESERVE=512
```

### **Database Setup (Neon)**
1. Create Neon project
2. Get connection string
3. Add to Vercel environment variables
4. Run migrations: `pnpm db:migrate`

### **Storage Setup (Vercel Blob)**
1. Enable Blob storage in Vercel
2. Get read/write token
3. Add to environment variables

## 🔍 **Debugging Deployment Issues**

### **Check Build Logs**
```bash
# View deployment logs
vercel logs [deployment-url]

# Check specific function logs
vercel logs [deployment-url] --function=api/chat/route
```

### **Common Error Patterns**

1. **"POSTGRES_URL is not defined"**:
   - Check environment variables in Vercel dashboard
   - Ensure variable name matches exactly

2. **"Migration failed"**:
   - Check database connectivity
   - Verify migration files exist
   - Run migrations manually first

3. **"Build timeout"**:
   - Reduce build complexity
   - Use `pnpm build` instead of `pnpm build:migrate`
   - Check for infinite loops in code

4. **"Function timeout"**:
   - Optimize API routes
   - Add proper error handling
   - Check for memory leaks

## 📊 **Monitoring & Maintenance**

### **Health Checks**
- Monitor Vercel Functions dashboard
- Check database connection status
- Monitor CEREBRO metrics (if enabled)

### **Regular Maintenance**
```bash
# Weekly: Check for updates
pnpm update

# Monthly: Review deployment logs
vercel logs --since=30d

# Quarterly: Security audit
pnpm audit
```

## 🆘 **Emergency Rollback**

If deployment fails:
```bash
# Rollback to previous version
vercel rollback [deployment-url]

# Or redeploy previous commit
git checkout [previous-commit]
vercel --prod
```

## 📞 **Getting Help**

- **Vercel Support**: https://vercel.com/support
- **Next.js Docs**: https://nextjs.org/docs
- **AI SDK Docs**: https://ai-sdk.dev/docs
- **CEREBRO Issues**: Check `lib/memory/README.md`

---

**Remember**: Start simple, add complexity gradually. Deploy the basic chatbot first, then enable CEREBRO features once the foundation is stable.
