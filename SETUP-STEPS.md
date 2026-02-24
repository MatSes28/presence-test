# CLIRDEC — Clear setup steps

Follow **either** Part A (run on your PC) **or** Part B (deploy on Railway).

---

## Quick start (Node + PostgreSQL already installed)

1. Create the database: `createdb clirdec`
2. Ensure `.env` exists in the project root (one is created with defaults; edit `DATABASE_URL` if your Postgres user/password differ).
3. From the project root run:
   - **Option A:** `npm run setup` then `npm run dev`
   - **Option B (Windows):** `scripts\setup-and-run.bat`
4. In another terminal, create the first admin:
   ```bash
   curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"admin123\",\"full_name\":\"Admin\",\"role\":\"admin\"}"
   ```
5. Open http://localhost:5173 and log in with `admin@school.com` / `admin123`.

---

## Part A: Run on your computer (local)

### Step 1: Install Node.js
- Download Node.js 18 or newer from https://nodejs.org
- Install it, then open a **new** terminal.

### Step 2: Install PostgreSQL
- Install PostgreSQL on your PC (e.g. from https://www.postgresql.org/download or use Laravel Herd’s built-in Postgres if you have it).
- Make sure it’s running and you can connect (default port 5432).

### Step 3: Create the database
In a terminal:

```bash
createdb clirdec
```

(If that doesn’t work, open PostgreSQL (e.g. pgAdmin or `psql`) and create a database named `clirdec`.)

### Step 4: Go to the project folder
```bash
cd "c:\Users\ASUS TUF\Herd\presence-test"
```

### Step 5: Install dependencies
```bash
npm install
```

### Step 6: Create environment file
- Create a new file named `.env` in the project root: `c:\Users\ASUS TUF\Herd\presence-test\.env`
- Put this inside (change the password if your Postgres user is different):

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/clirdec
JWT_SECRET=any-long-random-string-you-want
PORT=3001
```

(Replace `postgres` and `password` with your PostgreSQL username and password if needed.)

### Step 7: Create database tables
```bash
npm run db:migrate
```

You should see: `Migration completed.`

### Step 8: Create the first admin user
Run this once (change email/password if you like):

```bash
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"admin123\",\"full_name\":\"Admin\",\"role\":\"admin\"}"
```

If you don’t have `curl`, use Postman or the browser console on the app later — or skip and use the **Login** page after the app is running (you’ll need to add a register option or run this from a tool).

**Note:** The backend must be running for this to work. So either:
- Run the backend first (Step 9), then in **another** terminal run the curl command above,  
- Or run the curl command after you’ve started the app in Step 9.

### Step 9: Start the app
```bash
npm run dev
```

- Backend runs at: **http://localhost:3001**
- Frontend runs at: **http://localhost:5173**

### Step 10: Open the app and log in
1. Open a browser and go to: **http://localhost:5173**
2. Log in with the admin account you created (e.g. `admin@school.com` / `admin123`).

You’re done for local. Use **Sessions** to start a class session, **Users** to add students and link RFID cards, and **Dashboard** to see live attendance.

---

## Part B: Deploy on Railway

### Step 1: Create a Railway account
- Go to https://railway.app and sign up (e.g. with GitHub).

### Step 2: Create a new project
- Click **New Project**.
- Choose **Deploy from GitHub repo** and connect your GitHub account.
- Select the repo that contains this CLIRDEC project (e.g. `presence-test` or your fork).

### Step 3: Add a PostgreSQL database
- In the same project, click **New** → **Database** → **PostgreSQL**.
- Wait until it’s provisioned. Railway will show a **DATABASE_URL** (or similar) in the Variables tab.

### Step 4: Configure the web service (your app)
- Click on the **service** that runs your code (the one from the repo), not the database.
- Go to **Variables** (or **Settings** → **Variables**).
- Add these variables (click **New Variable** for each):

| Name          | Value                                      |
|---------------|--------------------------------------------|
| `DATABASE_URL`| (paste from the PostgreSQL service’s Variables — or use “Reference” to link it) |
| `JWT_SECRET`  | A long random string (e.g. 32+ characters)  |
| `NODE_ENV`    | `production`                                |

- Save. Railway usually sets `PORT` for you; you don’t need to add it.

### Step 5: Set build and start commands (if needed)
Railway often detects them from the repo. If not, set:

- **Build command:** `npm run build`
- **Start command:** `npm run start`
- **Root directory:** leave as the repo root (where `package.json` is).

### Step 6: Deploy
- Push your code to GitHub (if you haven’t). Railway will build and deploy.
- Or trigger a **Redeploy** from the Railway dashboard.
- Wait until the build finishes and the service shows as running.

### Step 7: Run migrations once (on Railway)
- In Railway, open your **web service** (not the database).
- Go to **Settings** or the **Shell** / **Run command** option.
- Run:

```bash
npm run db:migrate
```

(Use the exact command Railway provides for “one-off run” or “shell” so the app’s environment and `DATABASE_URL` are used.)

### Step 8: Get your app URL
- In the web service, go to **Settings** → **Networking** or **Domains**.
- Add a **Public domain** if you don’t have one. Copy the URL (e.g. `https://your-app.up.railway.app`).

### Step 9: Create the first admin user
Use the URL from Step 8. In a terminal or Postman:

```bash
curl -X POST https://YOUR-APP-URL.up.railway.app/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"admin123\",\"full_name\":\"Admin\",\"role\":\"admin\"}"
```

Replace `YOUR-APP-URL.up.railway.app` with your real Railway URL.

### Step 10: Use the app
- Open **https://YOUR-APP-URL.up.railway.app** in your browser.
- Log in with the admin account you just created.

---

## Quick reference

| Goal                    | Command or action |
|-------------------------|--------------------|
| Run locally             | `npm run dev`      |
| Create DB tables        | `npm run db:migrate` |
| Build for production   | `npm run build`    |
| Create admin (local)   | `curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"admin123\",\"full_name\":\"Admin\",\"role\":\"admin\"}"` |

If you tell me whether you’re doing **Part A (local)** or **Part B (Railway)** and where you’re stuck (e.g. “Step 5”, “database”, “first admin”), I can give you the exact next step for your case.
