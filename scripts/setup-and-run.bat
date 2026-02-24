@echo off
REM Run from project root in a terminal where Node and npm are available.
REM Ensure PostgreSQL is running and database exists: createdb clirdec
setlocal
cd /d "%~dp0.."
if not exist ".env" ( echo Create .env first. Copy .env.example and set DATABASE_URL, JWT_SECRET. & exit /b 1 )
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 ( echo Failed at npm install. & exit /b 1 )
echo [2/4] Running database migrations...
call npm run db:migrate
if errorlevel 1 ( echo Failed at db:migrate. Ensure PostgreSQL is running and database clirdec exists. & exit /b 1 )
echo [3/4] Starting backend and frontend...
echo Backend: http://localhost:3001  Frontend: http://localhost:5173
echo [4/4] Create first admin in another terminal: curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@school.com\",\"password\":\"admin123\",\"full_name\":\"Admin\",\"role\":\"admin\"}"
call npm run dev
