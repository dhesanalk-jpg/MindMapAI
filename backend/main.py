from __future__ import annotations

import io
import os
import re
from datetime import date, timedelta
from typing import Any

import httpx
from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader

app = FastAPI(title="MindMap AI API", version="1.0.0")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanRequest(BaseModel):
    topics: list[dict[str, Any]]
    exam_date: date
    hours_per_day: float = Field(default=2.0, ge=0.5, le=12)
    start_date: date = Field(default_factory=date.today)
    study_days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    break_days: list[str] = Field(default_factory=list)

class QuestionRequest(BaseModel):
    topic: str
    subject: str = "General"
    difficulty: str = "Mixed"
    count: int = Field(default=5, ge=1, le=20)
    source_text: str = ""

def extract_text(filename: str, content: bytes) -> str:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        if suffix == "pdf":
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        if suffix == "docx":
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        if suffix in {"txt", "md"}:
            return content.decode("utf-8", errors="ignore")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read document: {exc}")
    raise HTTPException(status_code=415, detail="Supported formats: PDF, DOCX, TXT, MD")

def clean_topic(line: str) -> str:
    line = re.sub(r"^\s*(unit|module|chapter|topic|part)\s*[-:.\dIVX ]*", "", line, flags=re.I)
    line = re.sub(r"^\s*[\dIVX]+[\).:-]\s*", "", line, flags=re.I)
    return re.sub(r"\s+", " ", line).strip(" •-\t")

def parse_topics(text: str) -> list[dict[str, Any]]:
    candidates = []
    seen = set()
    for raw in text.splitlines():
        line = clean_topic(raw)
        if not line or len(line) < 3 or len(line) > 110:
            continue
        if re.search(r"(course outcomes|question paper|text book|references|department of|university|semester|total marks|page \d+)", line, re.I):
            continue
        if len(line.split()) > 13:
            continue
        key = line.lower()
        if key not in seen:
            seen.add(key)
            candidates.append(line)
    # If the source is a paragraph, split on semicolons and numbered topic patterns.
    if len(candidates) < 3:
        for piece in re.split(r"[;\n]", text):
            line = clean_topic(piece)
            if 4 <= len(line) <= 100 and len(line.split()) <= 12 and line.lower() not in seen:
                seen.add(line.lower())
                candidates.append(line)
    return [
        {
            "id": f"topic-{i+1}",
            "title": title,
            "subject": "Imported syllabus",
            "unit": f"Unit {(i // 4) + 1}",
            "difficulty": ["Medium", "Hard", "Easy", "Medium"][i % 4],
            "estimated_hours": [1.0, 1.5, 0.75, 1.25][i % 4],
            "status": "not_started",
            "confidence": 0,
            "source": "Uploaded document"
        }
        for i, title in enumerate(candidates[:80])
    ]

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MindMap AI", "version": "1.0.0", "ai_configured": bool(os.getenv("GEMINI_API_KEY"))}

@app.post("/api/analyze-syllabus")
async def analyze_syllabus(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be smaller than 12 MB.")
    text = extract_text(file.filename or "syllabus.txt", content)
    if not text.strip():
        raise HTTPException(status_code=422, detail="No readable text found. Scanned PDFs need OCR before upload.")
    topics = parse_topics(text)
    if not topics:
        raise HTTPException(status_code=422, detail="No clear topic headings found. Try a text-based syllabus or paste the syllabus text.")
    return {
        "filename": file.filename,
        "characters_extracted": len(text),
        "topics_found": len(topics),
        "topics": topics,
        "preview": text[:1800],
        "source_text": text[:20000]
    }

@app.post("/api/plan")
def create_plan(request: PlanRequest):
    if request.exam_date <= request.start_date:
        raise HTTPException(status_code=422, detail="Exam date must be after the plan start date.")
    topics = request.topics
    if not topics:
        raise HTTPException(status_code=422, detail="Add at least one topic.")
    days = []
    cursor = request.start_date
    while cursor < request.exam_date:
        if cursor.weekday() in request.study_days and cursor.isoformat() not in request.break_days:
            days.append(cursor)
        cursor += timedelta(days=1)
    if not days:
        raise HTTPException(status_code=422, detail="No available study days before the exam.")
    weighted = sorted(
        topics,
        key=lambda t: (
            {"Hard": 0, "Medium": 1, "Easy": 2}.get(str(t.get("difficulty", "Medium")), 1),
            -float(t.get("estimated_hours", 1))
        )
    )
    capacity = max(1, int(request.hours_per_day / 0.5))
    sessions = []
    for index, topic in enumerate(weighted):
        day = days[index % len(days)]
        duration = min(float(topic.get("estimated_hours", 1.0)), request.hours_per_day)
        sessions.append({
            "id": f"session-{index+1}",
            "date": day.isoformat(),
            "topic_id": topic.get("id"),
            "topic": topic.get("title", "Untitled topic"),
            "duration_hours": round(duration, 1),
            "type": "Learn" if topic.get("status") != "completed" else "Revision",
            "reason": "Prioritised by difficulty and estimated effort."
        })
    # Add revision checkpoints in the final available study days.
    for idx, day in enumerate(days[-min(3, len(days)):]):
        sessions.append({
            "id": f"revision-{idx+1}",
            "date": day.isoformat(),
            "topic_id": None,
            "topic": "Active recall + weak-topic revision",
            "duration_hours": round(min(0.5, request.hours_per_day), 1),
            "type": "Revision",
            "reason": "Reserved revision buffer before the exam."
        })
    return {"sessions": sessions, "study_days": len(days), "exam_date": request.exam_date.isoformat()}

QUESTION_TEMPLATES = [
    ("Recall", "Define {topic} and explain its purpose."),
    ("Concept", "Explain the core idea behind {topic} in your own words."),
    ("Application", "Give a real-world example where {topic} would be useful. Justify your answer."),
    ("Compare", "Compare {topic} with a closely related concept. State two differences."),
    ("Analysis", "Break {topic} into its key components and explain how they relate."),
    ("Exam-style", "Write a structured answer on {topic}, including an introduction, key points and conclusion."),
    ("Teach-back", "Imagine teaching {topic} to a beginner. What are the three ideas they must understand first?")
]

@app.post("/api/questions")
async def generate_questions(request: QuestionRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            prompt = (
                f"Create {request.count} accurate {request.difficulty} practice questions for {request.subject} "
                f"on {request.topic}. Return ONLY a JSON array with question, type, answer, explanation. "
                f"Use this source material if provided: {request.source_text[:9000]}"
            )
            async with httpx.AsyncClient(timeout=25) as client:
                response = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
                    params={"key": api_key},
                    json={"contents": [{"parts": [{"text": prompt}]}]}
                )
                response.raise_for_status()
                payload = response.json()
                generated = payload["candidates"][0]["content"]["parts"][0]["text"]
                match = re.search(r"\[[\s\S]*\]", generated)
                if match:
                    import json
                    questions = json.loads(match.group(0))
                    return {"questions": questions[:request.count], "mode": "gemini"}
        except Exception:
            pass
    questions = []
    for i in range(request.count):
        kind, template = QUESTION_TEMPLATES[i % len(QUESTION_TEMPLATES)]
        questions.append({
            "question": template.format(topic=request.topic),
            "type": kind,
            "answer": f"Build your answer around the definition, core principles, an example and why {request.topic} matters.",
            "explanation": "Use your syllabus notes to verify terminology and include relevant examples.",
            "difficulty": request.difficulty
        })
    return {"questions": questions, "mode": "template"}

@app.post("/api/plan-rescue")
def plan_rescue(payload: dict[str, Any]):
    remaining = payload.get("remaining_topics", [])
    available_days = payload.get("available_days", 3)
    if not isinstance(available_days, int) or available_days < 1:
        raise HTTPException(status_code=422, detail="available_days must be at least 1.")
    slots = [[] for _ in range(available_days)]
    ordered = sorted(remaining, key=lambda t: 0 if t.get("difficulty") == "Hard" else 1)
    for i, topic in enumerate(ordered):
        slots[i % available_days].append(topic.get("title", "Untitled topic"))
    return {
        "message": "Your plan has been redistributed. Revision time is protected in the final day.",
        "days": [{"day": i + 1, "topics": topics, "buffer": i == available_days - 1} for i, topics in enumerate(slots)]
    }
