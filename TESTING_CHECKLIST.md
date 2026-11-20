# Smoke-test checklist

## Frontend
- [ ] `npm install` completes.
- [ ] `npm run build` completes without TypeScript errors.
- [ ] Dashboard loads on desktop and mobile.
- [ ] Navigation opens all five views.
- [ ] Browser refresh preserves topics and sessions.
- [ ] Topic search filters correctly.
- [ ] Empty state appears when no topics match.

## Backend
- [ ] `GET /api/health` returns status ok.
- [ ] Upload a text-based PDF and confirm topics are returned.
- [ ] Upload DOCX and TXT files.
- [ ] Invalid file extension returns 415.
- [ ] Scanned PDF returns a readable error if no text is extractable.
- [ ] Plan endpoint rejects an exam date in the past.
- [ ] Questions endpoint returns template questions without a Gemini key.
- [ ] Plan rescue returns a redistribution.

## Deployment
- [ ] Frontend API base points to the deployed API.
- [ ] CORS origin is restricted to the deployed frontend.
- [ ] Gemini key is configured only on the backend.
- [ ] No `.env`, API key, `.venv`, `node_modules`, or local database is committed.
- [ ] README limitations are reviewed before public demo.
