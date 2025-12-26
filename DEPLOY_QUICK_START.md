# 🚀 DEPLOY VERCEL - QUICK START

## ⚡ 3 bước nhanh (5 phút)

### Bước 1: Cài Vercel CLI
```bash
npm install -g vercel
```

### Bước 2: Login
```bash
vercel login
```

### Bước 3: Deploy 🎉
```bash
# Windows PowerShell:
.\deploy.ps1

# hoặc Linux/Mac:
./deploy.sh

# hoặc trực tiếp:
vercel --prod
```

---

## ✨ Kết quả

✅ App sẽ có URL: `https://airport-ops-manager.vercel.app`
✅ HTTPS tự động
✅ Deploy lại tự động khi push code (nếu link GitHub)

---

## 📋 Checklist

- [x] Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [x] Build config: `vite.config.ts` có tối ưu
- [x] Deploy config: `vercel.json` sẵn sàng
- [x] Supabase connection test

---

## 🔍 Test sau deploy

1. Vào https://airport-ops-manager.vercel.app
2. Login → upload file → xem analytics
3. Kiểm tra Vercel Dashboard → Analytics

---

## 📞 Gặp sự cố?

**Build fail?** → `npm run build` locally test trước

**App loads nhưng blank?** → Kiểm tra browser console (F12)

**Supabase error?** → Set env vars trong Vercel dashboard

---

## 📚 Chi tiết xem: DEPLOY_TO_VERCEL.md
