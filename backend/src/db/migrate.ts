import dotenv from 'dotenv'
import { db } from './index'

dotenv.config()

function migrate() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('intern','mentor','hr')),
        department TEXT,
        mbti_type TEXT,
        has_experience INTEGER DEFAULT 0,
        intern_type TEXT CHECK (intern_type IN ('summer','regular')),
        avatar_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS invite_keys (
        id TEXT PRIMARY KEY,
        key_value TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        used_by TEXT REFERENCES users(id),
        created_by TEXT REFERENCES users(id),
        expires_at TEXT,
        used_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS intern_periods (
        id TEXT PRIMARY KEY,
        intern_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        mentor_id TEXT REFERENCES users(id),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS onboarding_progress (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        current_step INTEGER DEFAULT 1,
        steps_data TEXT DEFAULT '{}',
        completed_at TEXT
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT,
        parent_id TEXT REFERENCES skills(id),
        description TEXT,
        resources TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS user_skills (
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        skill_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'locked' CHECK (status IN ('mastered','in_progress','locked')),
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, skill_id)
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_by TEXT REFERENCES users(id),
        assigned_to TEXT REFERENCES users(id),
        due_date TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','overdue')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await exec(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        role TEXT CHECK (role IN ('user','assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    console.log('✅ 数据库迁移完成')
  } catch (error) {
    console.error('❌ 迁移失败', error)
    process.exit(1)
  }
}

migrate()
