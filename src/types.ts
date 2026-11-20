export type Topic = {
  id: string
  title: string
  subject: string
  unit: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  estimated_hours: number
  status: 'not_started' | 'in_progress' | 'completed'
  confidence: number
  source?: string
}
export type Session = {
  id: string
  date: string
  topic_id: string | null
  topic: string
  duration_hours: number
  type: string
  reason: string
}
export type Question = {
  question: string
  type: string
  answer: string
  explanation: string
  difficulty?: string
}
