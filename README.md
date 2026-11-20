# MindMap AI — Smart Study Planner

MindMap AI turns a student's syllabus into a structured, adaptive study workflow.

## Features in this MVP

- PDF, DOCX, TXT and Markdown syllabus upload.
- Text extraction and heuristic topic detection.
- Knowledge Constellation topic map.
- Daily study plan generation based on topic difficulty, estimated effort and exam date.
- Plan Rescue endpoint for redistributing unfinished topics.
- Practice question generation with deterministic fallback.
- Optional Gemini-powered question generation using a server-side environment variable.
- Topic completion, confidence tracking and progress dashboard.
- Browser-local persistence for demo progress.

## Tech stack

- Frontend: React, TypeScript, Vite, CSS, lucide-react.
- Backend: Python, FastAPI, pypdf, python-docx.
- Deployment target: Vercel frontend + Python FastAPI backend.

## Run locally (Windows PowerShell)

Open two terminals from the project root.

### Terminal 1 — backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend docs: http://127.0.0.1:8000/docs

### Terminal 2 — frontend

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173).

For local development, set `VITE_API_BASE=http://127.0.0.1:8000/api` in `.env` if using the separate backend port. Restart Vite after changing `.env`.

## Vercel deployment (recommended: two Vercel projects from one GitHub repository)

Vercel supports Vite frontends and FastAPI Python backends. Deploy them separately from the same repository for the simplest, most reliable setup. The frontend and backend remain in separate folders.

### A. Deploy the backend
1. Push this repository to GitHub.
2. In Vercel, create a new project and import the repository.
3. Set **Root Directory** to `backend`.
4. Framework should be detected as FastAPI/Python (or select the Python/FastAPI option if prompted).
5. Do not set a Node build command or static output directory for the backend.
6. Add environment variable `CORS_ORIGINS` with your frontend URL after you deploy the frontend.
7. Optionally add `GEMINI_API_KEY` as a backend-only environment variable.
8. Deploy and test `https://YOUR-BACKEND.vercel.app/api/health`.

### B. Deploy the frontend
1. Create another Vercel project from the same GitHub repository.
2. Set **Root Directory** to `.` (repository root).
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add environment variable `VITE_API_BASE` with `https://YOUR-BACKEND.vercel.app/api`.
7. Deploy.

### C. Connect CORS
Go back to the backend Vercel project and set `CORS_ORIGINS` to the exact deployed frontend origin, for example `https://mindmap-ai.vercel.app` (no trailing slash). Redeploy the backend.

For local development, set `VITE_API_BASE=http://127.0.0.1:8000/api` in `.env`. Restart Vite after changing environment variables.

Vercel's Python runtime supports FastAPI and Python 3.12. See the official guide: https://vercel.com/docs/frameworks/backend/fastapi

## Optional Gemini integration

Set `GEMINI_API_KEY` as a backend environment variable in Vercel or your local shell. Never put this key in a `VITE_` variable or frontend source code.

Without a key, `/api/questions` returns structured template-based practice prompts. With a key and source text, it attempts Gemini question generation and falls back to templates if the provider call fails.

## Important limitations — read before presenting as production-ready

1. **Topic extraction is heuristic.** It extracts readable text and guesses likely topic headings. It is not a trained document-understanding model. Review imported topics before relying on them.
2. **Scanned PDFs are not OCR'd.** The current backend requires selectable text. Add OCR (for example, Tesseract or a managed document AI service) for scanned documents.
3. **The scheduling algorithm is a deterministic MVP heuristic.** It prioritises hard topics and spreads topics across available days; it is not an AI optimiser and does not yet model prerequisite graphs or calendar conflicts.
4. **Practice prompts are not verified exam predictions.** The fallback mode generates useful question prompts, not factual answer keys. Review content against course material.
5. **Progress is stored in browser localStorage.** It is device/browser-specific and can be cleared by the user. There is no account system or cloud sync yet.
6. **Vercel serverless storage is ephemeral.** Do not store permanent uploads or SQLite data on the function filesystem. Add object storage and a hosted database for production.
7. **No authentication or multi-user isolation.** Do not use this demo for private student records until authentication, authorisation, validation, rate limiting and privacy controls are implemented.

## Suggested next production milestones

- Authentication and user-specific database (PostgreSQL/Supabase).
- Durable document storage (S3-compatible storage).
- OCR for scanned PDFs and image-based syllabi.
- Structured AI topic extraction with source page references.
- Prerequisite graph generation and editable dependency links.
- True spaced repetition using review history.
- Adaptive schedule optimisation with availability, holidays and workload constraints.
- Evidence-based quiz scoring and confidence calibration.
- Unit tests, integration tests, security review and monitoring.

## Repository structure

```text
MindMap-AI/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── src/
│   ├── lib/api.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tsconfig*.json
├── (no custom Vercel config required)
└── vite.config.ts
```

## Functional demo upgrade

This version starts with an empty workspace instead of preloaded DBMS sample topics. On the first launch after upgrading, it also clears the original bundled `t1`–`t8` demo records from local browser storage.

### Editable workspace

- Import a text-based PDF, DOCX, TXT or Markdown syllabus from Overview or Knowledge map.
- Add topics manually from Knowledge map or Settings.
- Edit a topic's title, subject, unit, difficulty and estimated study time.
- Delete topics and remove their related study sessions.
- Mark topics complete and generate a study plan from the topics you have added/imported.
- Topics, sessions, exam date, study hours and extracted source text persist in browser localStorage on that device.
- Settings provides a clear-workspace action and displays separate backend and AI-provider status.

### Honest integration status

The `Backend online` indicator checks only the FastAPI `/api/health` endpoint. The separate `AI configured` indicator reports whether `GEMINI_API_KEY` is present on the backend. When the key is absent or the provider call fails, practice generation falls back to clearly labelled template prompts. Uploaded extracted text is passed to Gemini when the provider is configured.

Set `GEMINI_API_KEY` only in the backend environment. Never put the key in a `VITE_` frontend variable or commit it to Git.

### Important limitations

- Scanned/image-only PDFs require OCR and are not parsed by this MVP.
- Topic extraction uses text heuristics; review and edit the extracted topics before planning.
- Browser localStorage is device/browser-specific, not a multi-user cloud database.
- The study plan and fallback practice questions are deterministic demo functionality, not proof of a trained AI model.
