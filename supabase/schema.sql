-- ═══════════════════════════════════════════════════════════
-- 实习生导航系统 — Supabase PostgreSQL Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ═══════════════════════════════════════════════════════════

-- ── 用户表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('intern','mentor','hr')),
  department TEXT,
  mbti_type TEXT,
  has_experience BOOLEAN DEFAULT FALSE,
  intern_type TEXT CHECK (intern_type IN ('summer','regular')),
  avatar_url TEXT,
  intern_start_date TEXT,
  intern_end_date TEXT,
  mentor_id TEXT REFERENCES users(id),
  on_leave BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 邀请密钥表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_keys (
  id TEXT PRIMARY KEY,
  key_value TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  used_by TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- ── 技能树表 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  parent_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
  description TEXT,
  resources TEXT DEFAULT '[]',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 技能反馈表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_feedbacks (
  id TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL REFERENCES users(id),
  mentor_id TEXT NOT NULL REFERENCES users(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  content TEXT NOT NULL,
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 用户技能关联表 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_skills (
  user_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- ── 任务表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  due_date TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 入职引导进度表 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  current_step INTEGER DEFAULT 1,
  steps_data TEXT DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI 对话记录表 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ── 通知表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 消息表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 导师自定义任务表 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mentor_tasks (
  id TEXT PRIMARY KEY,
  intern_id TEXT NOT NULL REFERENCES users(id),
  mentor_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
  department TEXT,
  skill_source_id TEXT REFERENCES skills(id),
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked','in_progress','mastered')),
  due_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 部门共享任务表 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS department_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  department TEXT NOT NULL,
  category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
  skill_source_id TEXT REFERENCES skills(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  due_date TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','archived')),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 用户技能自定义任务表 ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_skill_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  due_date TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- 索引（提升查询性能）
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_mentor_id ON users(mentor_id);
CREATE INDEX IF NOT EXISTS idx_invite_keys_key_value ON invite_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_skills_department ON skills(department);
CREATE INDEX IF NOT EXISTS idx_skills_parent_id ON skills(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_tasks_intern_id ON mentor_tasks(intern_id);
CREATE INDEX IF NOT EXISTS idx_department_tasks_department ON department_tasks(department);
CREATE INDEX IF NOT EXISTS idx_user_skill_tasks_user_id ON user_skill_tasks(user_id);
