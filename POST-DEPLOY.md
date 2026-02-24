# Post-deploy: get the app live

Do these **after** your Railway service is built and running (green).

---

## 1. Migrations

**If you set Pre-deploy Command to `npm run db:migrate`** in Railway (Deploy settings), migrations run automatically before each deploy. No manual step needed.

**Otherwise**, run once in **Railway** → your **web service** → **Shell** (or Run command), run:

```bash
npm run db:migrate
```

You should see something like “Migration completed.”

---

## 2. Create first admin (from your PC)

Replace `https://your-app.railway.app` with your real Railway URL.

```bash
RAILWAY_URL=https://your-app.railway.app npm run create-admin
```

To set a custom password:

```bash
ADMIN_PASSWORD=YourSecurePassword RAILWAY_URL=https://your-app.railway.app npm run create-admin
```

---

## 3. Log in

Open your app URL in a browser and sign in with the admin email and password you used above (default: `admin@school.com` / `admin123` if you didn’t set `ADMIN_PASSWORD`).

---

## 4. Production settings (Railway Variables)

In Railway → your service → **Variables**, ensure:

- `NODE_ENV` = `production`
- `JWT_SECRET` = long random string (≥32 characters)
- `CORS_ORIGIN` = your app URL (e.g. `https://your-app.railway.app`)
- `REQUIRE_HTTPS` = `1`

Then run **Redeploy** so the new variables are used.

---

That’s it. For the full list, see [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md).
