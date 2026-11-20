import type { Question, Session, Topic } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${response.status})`)
  }
  return response.json()
}

export async function checkHealth() {
  return request<{status:string}>('/health')
}

export async function analyzeFile(file: File): Promise<{topics: Topic[]; filename: string; characters_extracted: number; source_text?: string}> {
  const form = new FormData()
  form.append('file', file)
  return request('/analyze-syllabus', { method: 'POST', body: form })
}

export async function buildPlan(topics: Topic[], examDate: string, hours: number): Promise<{sessions: Session[]}> {
  return request('/plan', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({topics, exam_date: examDate, hours_per_day: hours})
  })
}

export async function makeQuestions(topic: string, subject: string, count = 5, sourceText = ''): Promise<{questions: Question[]; mode: string}> {
  return request('/questions', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({topic, subject, count, difficulty: 'Mixed', source_text: sourceText})
  })
}

export async function rescuePlan(topics: Topic[], availableDays: number) {
  return request<{message:string;days:{day:number;topics:string[];buffer:boolean}[]}>('/plan-rescue', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({remaining_topics:topics, available_days:availableDays})
  })
}
