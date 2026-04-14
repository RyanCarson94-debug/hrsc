export type Bucket = 'NOW' | 'SOON' | 'LATER'
export type Effort = 'LOW' | 'MEDIUM' | 'HIGH'
export type TaskStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ABANDONED'

export interface TaskStep {
  id: string
  task_id: string
  title: string
  sort_order: number
  completed: number // 0 | 1 (SQLite boolean)
}

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  bucket: Bucket
  effort: Effort
  duration_mins: number
  status: TaskStatus
  resistance_count: number
  scheduled_at: string | null
  created_at: string
  updated_at: string
  steps: TaskStep[]
}

export interface FocusSession {
  id: string
  user_id: string
  task_id: string
  started_at: string
  ended_at: string | null
  duration_mins: number | null
  status: SessionStatus
  steps_completed: number
  task: Task
}

export interface ScheduledBlock {
  id: string
  user_id: string
  task_id: string | null
  title: string
  date: string
  start_time: string
  end_time: string
  created_at: string
  task: { id: string; title: string; duration_mins: number } | null
}

export interface Insight {
  id: string
  text: string
  detail?: string
}

export interface UserSettings {
  id: string
  email: string
  name: string | null
  notifications_enabled: number
  preferred_session_mins: number
  work_context: string | null
}
