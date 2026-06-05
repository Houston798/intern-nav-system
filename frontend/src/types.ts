export type UserRole = 'intern' | 'mentor' | 'hr'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  mbti_type?: string
  has_experience?: boolean
  intern_type?: string
  avatar_url?: string
  intern_start_date?: string | null
  intern_end_date?: string | null
  mentor_id?: string | null
  created_at?: string
  onboarding_completed?: boolean
}

export type LoginResponse = {
  token: string
  user: User
}

export type Task = {
  id: string
  title: string
  description: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'done' | 'overdue'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  created_by?: string
  assigned_to?: string
  assigned_name?: string
  assigned_email?: string
}

export type Skill = {
  id: string
  name: string
  department: string
  description: string
  status: 'mastered' | 'in_progress' | 'locked'
  resources?: string[]
}

/** 技能树节点（含子节点层级） */
export type SkillTreeNode = {
  id: string
  name: string
  department: string | null
  parent_id: string | null
  category: 'basic' | 'department' | 'advanced'
  description: string | null
  resources_parsed: string[]
  order_index: number
  status: 'mastered' | 'in_progress' | 'locked'
  children: SkillTreeNode[]
}

/** 管理端扁平技能节点 */
export type SkillFlatNode = {
  id: string
  name: string
  department: string | null
  parent_id: string | null
  category: 'basic' | 'department' | 'advanced'
  description: string | null
  resources_parsed: string[]
  order_index: number
  child_count: number
  created_at: string
}

/** 技能树 API 响应 */
export type SkillTreeResponse = {
  department: string | null
  tree: SkillTreeNode[]
  grouped?: SkillGrouped[]
}

/** 技能三阶分组 */
export type SkillGrouped = {
  category: 'basic' | 'department' | 'advanced'
  categoryLabel: string
  categoryIcon: string
  nodes: SkillTreeNode[]
}

/** 导师端：实习生技能概览 */
export type MentorIntern = {
  id: string
  name: string
  email: string
  department: string | null
  avatar_url?: string
  intern_start_date?: string
  intern_end_date?: string
  skillProgress: {
    total: number
    mastered: number
    inProgress: number
    notStarted: number
    percent: number
  }
  customTaskProgress?: {
    total: number
    mastered: number
    inProgress: number
    notStarted: number
    percent: number
  }
}

/** 导师端：实习生完整技能树响应 */
export type MentorInternDetail = {
  intern: { id: string; name: string; email: string; department: string | null }
  tree: SkillTreeNode[]
  grouped: SkillGrouped[]
  feedbacks: SkillFeedback[]
  customTasks?: MentorTask[]
}

/** 导师自定义任务 */
export type MentorTask = {
  id: string
  intern_id: string
  mentor_id: string
  title: string
  description: string
  category: 'basic' | 'department' | 'advanced'
  department?: string | null
  skill_source_id?: string | null
  status: 'locked' | 'in_progress' | 'mastered'
  due_date: string | null
  order_index: number
  mentor_name?: string
  created_at: string
  updated_at: string
}

/** 导师反馈 */
export type SkillFeedback = {
  id: string
  intern_id: string
  mentor_id: string
  skill_id: string
  content: string
  rating: number
  skill_name?: string
  mentor_name?: string
  created_at: string
}

export type Notification = {
  id: string
  user_id?: string
  type: string
  title: string
  content: string
  is_read: boolean
  created_at: string
}

export type OnboardingProgress = {
  current_step: number
  steps_data: Record<string, unknown>
  completed_at: string | null
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type Toast = {
  id: string
  type: ToastType
  message: string
  exiting?: boolean
}

// ── 邀请密钥 ──────────────────────────
export type InviteKey = {
  id: string
  key_value: string
  role: UserRole
  created_at: string
  used_by: string | null
  used_at: string | null
  used_by_name?: string
  used_by_email?: string
}

// ── 统计数据 ──────────────────────────
export type UserStats = {
  total: number
  byRole: Record<string, number>
  byDept: Array<{ department: string; count: number }>
  weeklyNew: number
  todayNew: number
  myInterns: number
  inviteStats: {
    total: number
    used: number
    available: number
  } | null
}

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  sender_name?: string
  sender_role?: string
  receiver_name?: string
  receiver_role?: string
}

export type Contact = {
  id: string
  name: string
  role: UserRole
  department?: string
  avatar_url?: string
  unread: number
}

export type TaskStats = {
  total: number
  inProgress: number
  done: number
  overdue: number
  pending: number
}

/** 技能树发布任务响应 */
export type PublishTaskResult = {
  success: boolean
  intern: { id: string; name: string; department: string }
  created: number
  skipped: number
  taskIds: string[]
  message: string
}

/** 导师用户（含部门） */
export type MentorUser = User & {
  department: string
}

/** 部门共享任务（同部门所有实习生可见） */
export type DepartmentTask = {
  id: string
  title: string
  description: string
  department: string
  category: 'basic' | 'department' | 'advanced'
  skill_source_id: string | null
  created_by: string
  creator_name?: string
  due_date: string | null
  status: 'active' | 'archived'
  order_index: number
  created_at: string
  updated_at: string
}

/** 批量创建部门任务响应 */
export type BatchDeptTaskResult = {
  success: boolean
  department: string
  created: number
  skipped: number
  message: string
}

/** 用户自定义技能任务（挂载在技能节点下） */
export type UserSkillTask = {
  id: string
  user_id: string
  skill_id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  due_date: string | null
  order_index: number
  skill_name?: string
  department?: string
  created_at: string
  updated_at: string
}
