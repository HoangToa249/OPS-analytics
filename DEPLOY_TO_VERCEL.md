# 🚀 Hướng dẫn Deploy lên Vercel

## Cách 1: Deploy bằng Vercel CLI (Nhanh nhất - 2 phút)

### Bước 1: Cài đặt Vercel CLI
```bash
npm install -g vercel
```

### Bước 2: Login vào Vercel
```bash
vercel login
```
- Sẽ mở browser để xác thực
- Đăng nhập bằng GitHub/GitLab/Bitbucket hoặc email

### Bước 3: Deploy
```bash
vercel --prod
```

Quá trình deploy:
- ✅ Vercel sẽ nhận diện project là Vite + React
- ✅ Tự động chạy `npm run build`
- ✅ Đẩy thư mục `dist/` lên server
- ✅ Tạo domain tự động: `airport-ops-manager.vercel.app`

---

## Cách 2: Deploy bằng GitHub (Tự động, Khuyến nghị)

### Bước 1: Push code lên GitHub
```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

### Bước 2: Connect Vercel với GitHub
1. Vào https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import GitHub Repository → Chọn repo của bạn
4. Config:
   - **Framework**: Vite
   - **Build Command**: `npm run build` (auto-detect)
   - **Output Directory**: `dist`
   - **Node Version**: 18.x hoặc 20.x

### Bước 3: Set Environment Variables
Trong Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://fuixhbistsplpnznvkto.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Bước 4: Deploy
1. Click "Deploy" button
2. Chờ ~2-3 phút
3. Xong! App sẽ tự động deploy khi push code

---

## Cách 3: Deploy Manual (Dành cho testing)

### Bước 1: Build locally
```bash
npm run build
```
Tạo thư mục `dist/` chứa file production

### Bước 2: Upload lên Vercel
- Vào https://vercel.com/new
- Kéo thả thư mục `dist/` 
- Deploy ngay

---

## 🔐 Setup Supabase Environment Variables

### Trong Vercel Dashboard:
1. Project Settings → Environment Variables
2. Thêm 2 biến:

```
VITE_SUPABASE_URL = https://fuixhbistsplpnznvkto.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aXhoYmlzdHNwbHBuem52a3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Mzg2NTYsImV4cCI6MjA4MTAxNDY1Nn0.LiOM7SLhauM1ap8pxnXH_5utuHEzJypjR6mhciP_gIA
```

---

## 📝 File cấu hình đã tạo:

1. **`vercel.json`** - Cấu hình Vercel deployment
2. **`.env.production`** - Environment variables cho production

---

## ✅ Kiểm tra sau khi Deploy

1. **Test login**
   - Vào app URL
   - Thử login bằng tài khoản Supabase
   - Kiểm tra config save hoạt động

2. **Test features**
   - Import flight data
   - View analytics
   - Xem biểu đồ có load không

3. **Monitor**
   - Vercel Dashboard → Analytics
   - Xem traffic, response time, errors

---

## 🆘 Troubleshoot

### Error: "No matching export found"
→ Kiểm tra `vite.config.ts` có `base: '/'` không

### Error: "Supabase connection failed"
→ Kiểm tra environment variables đã set trong Vercel không

### Build fails
→ Chạy `npm run build` locally để test trước

### App loads nhưng page blank
→ Check browser console (F12) xem lỗi gì

---

## 📊 Kết quả cuối cùng

Sau deploy xong, bạn sẽ có:

✅ Public URL: `https://airport-ops-manager.vercel.app` (hoặc custom domain)
✅ Auto HTTPS
✅ CDN global 
✅ Auto scaling
✅ Free tier: 100 deployments/month, unlimited sites
✅ Analytics: Real-time traffic monitoring
✅ Auto deployment khi push code (nếu dùng GitHub)

---

## 💡 Tips

- **Free tier Vercel**: Đủ dùng cho production app nhỏ
- **Custom domain**: Thêm domain riêng trong Vercel Settings
- **Analytics**: Vercel Web Analytics có free tier
- **Backup**: Code vẫn ở GitHub, Vercel chỉ host

---

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.io/docs
- React + Vite: https://vitejs.dev/guide/ssr.html
