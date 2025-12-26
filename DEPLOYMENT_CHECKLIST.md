# ✅ Deployment Checklist - Airport OPS Manager

## Pre-Deployment ✅

### Project Setup
- [x] React 18 + TypeScript + Vite
- [x] Build system configured
- [x] Environment variables setup
- [x] Supabase integration ready
- [x] Code splitting optimized

### Build Verification
- [x] `npm run build` passes
- [x] No TypeScript errors
- [x] Chunks properly split (vendor, charts, utils, main)
- [x] Total size optimized (~1.8MB uncompressed)

### Configuration Files
- [x] `vite.config.ts` - Optimized with manualChunks
- [x] `vercel.json` - Deployment config ready
- [x] `.env.production` - Environment variables set
- [x] `deploy.sh` - Linux/Mac deploy script
- [x] `deploy.ps1` - Windows deploy script

---

## Deployment Steps

### Option A: Quick Deploy (5 minutes)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

### Option B: GitHub Integration (Recommended)
1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Set environment variables in Vercel dashboard
4. Auto-deploy on every push

---

## Post-Deployment Verification

### Access
- [ ] App opens at `https://airport-ops-manager.vercel.app`
- [ ] HTTPS working
- [ ] No mixed content warnings

### Features Test
- [ ] Login functionality works
- [ ] Import flight data works
- [ ] Analytics load and render
- [ ] Charts display correctly
- [ ] Export to Excel works
- [ ] Config saves to Supabase

### Performance
- [ ] Page loads in <3 seconds
- [ ] Lighthouse score >80
- [ ] No console errors (F12)
- [ ] Mobile responsive OK

### Monitoring
- [ ] Check Vercel Analytics
- [ ] Monitor error logs
- [ ] Track usage metrics

---

## Environment Variables on Vercel

Add these to Vercel Project Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://fuixhbistsplpnznvkto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aXhoYmlzdHNwbHBuem52a3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzg2NTYsImV4cCI6MjA4MTAxNDY1Nn0.LiOM7SLhauM1ap8pxnXH_5utuHEzJypjR6mhciP_gIA
```

---

## Troubleshooting

### Build Failures
- Run `npm run build` locally to diagnose
- Check Node version (need 18+)
- Clear cache: `rm -rf node_modules && npm install`

### Blank Page
- Check browser console (F12) for errors
- Verify environment variables set in Vercel
- Check network tab for failed requests

### Supabase Connection Issues
- Verify URL and key in environment variables
- Check Supabase project is active
- Review RLS policies in Supabase

### Performance Issues
- Use Vercel Analytics
- Check largest bundles
- Consider more aggressive code splitting

---

## Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Console**: https://app.supabase.com
- **Project GitHub**: [Your GitHub URL]

---

## Support URLs

When deployed, users can access:
- 🌍 **Main App**: https://airport-ops-manager.vercel.app
- 📊 **Analytics**: /analytics
- 🚀 **Dispatch**: /dispatch
- ⚙️ **Settings**: In-app config modal

---

## Maintenance

### Regular Tasks
- Monitor Vercel Analytics weekly
- Check error logs in Vercel
- Test login/data sync monthly
- Update dependencies quarterly

### Scaling (if needed)
- Vercel Pro: $20/month - Priority support, more deployments
- Custom domain: +$12/month
- Analytics: Free tier included

---

## Deploy Status

**Last Built**: $(date)
**Node Version**: 18.x or 20.x
**NPM Version**: 9.x or 10.x
**Vite Version**: 5.4.21
**React Version**: 18.2.0

---

## Sign-off

- [x] Code reviewed
- [x] Build tested locally
- [x] Environment ready
- [x] Documentation complete
- [x] Ready to deploy! 🚀

**Deploy Now**: `vercel --prod` or use deploy.ps1 / deploy.sh
