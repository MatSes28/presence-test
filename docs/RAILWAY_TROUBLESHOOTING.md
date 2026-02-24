# Railway deployment troubleshooting

## Build succeeds but deploy fails with "500 Internal Server Error" on registry

**Symptom:** Logs show:
- `npm run build` completes (frontend and backend built)
- `exporting to image` / `importing to docker`
- Then: `error: unexpected status from POST request to ... railway-registry.com/.../blobs/uploads/: 500 Internal Server Error`
- Sometimes: `panic: send on closed channel` (from Docker buildx)

**Cause:** Railway’s **container registry** returned 500 while accepting the image. The build itself succeeded; the failure is when pushing to Railway’s registry.

**What to do:**

1. **Retry the deploy**  
   Trigger a new deploy (Redeploy in the dashboard or push a small commit). Often these are transient.

2. **Wait and retry**  
   If it happens again, wait a few minutes and redeploy in case of a short outage.

3. **Check Railway status**  
   Check [status.railway.app](https://status.railway.app) or Railway’s Discord/support for any incident.

4. **Contact Railway**  
   If it keeps failing, open a ticket with Railway and include the deploy ID and the 500 from `railway-registry.com`.

No code or config changes are required for this error; it’s on Railway’s side.
