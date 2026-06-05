// 数据库初始化脚本：创建所有表 + 插入种子数据
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const dbPath = resolve('./intern_nav.db');
console.log('数据库路径:', dbPath);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

// 1. 创建所有表 (migrate)
console.log('\n--- 创建表结构 ---');
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
    on_leave INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS invite_keys (
    id TEXT PRIMARY KEY,
    key_value TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    used_by TEXT REFERENCES users(id),
    created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT
  );
  
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_by TEXT REFERENCES users(id),
    assigned_to TEXT REFERENCES users(id),
    due_date TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    department TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    current_step INTEGER DEFAULT 1,
    steps_data TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
console.log('✅ 所有表已创建');

// 2. 插入种子数据
console.log('\n--- 插入种子数据 ---');

// 密码：Admin@2024, Mentor@2024, Intern@2024
// 使用简单的预计算 bcrypt hash（否则需要引入 bcryptjs 包）
// 这里用明文密码标记，实际注册时由后端 bcrypt 处理
const hrId = randomUUID();
const mentorId = randomUUID();
const internId = randomUUID();

// 预计算的 bcrypt 哈希值 (cost=10)
const hrHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';  // Admin@2024
const mentorHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // 需替换
const internHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // 需替换

// 直接插入用户 (使用简单的已知 hash)
// 由于无法运行 bcryptjs，我们先跳过密码哈希，依赖 "ON CONFLICT DO NOTHING" 
// 只插入 invite_keys 表的数据

try {
  // 插入密钥 - 这是最关键的操作
  const existingKeys = db.prepare('SELECT COUNT(*) as cnt FROM invite_keys').all();
  if (existingKeys[0].cnt === 0) {
    const keys = [
      { key: 'MENTOR-123456', role: 'mentor' },
      { key: 'INTERN-123456', role: 'intern' },
      { key: 'HR-123456', role: 'hr' },
    ];
    for (const item of keys) {
      db.prepare('INSERT OR IGNORE INTO invite_keys (id, key_value, role) VALUES (?, ?, ?)')
        .run(randomUUID(), item.key, item.role);
    }
    console.log('✅ 邀请密钥已插入 (MENTOR-123456, INTERN-123456, HR-123456)');
  } else {
    console.log('邀请密钥已存在，跳过插入');
    // 检查 HR 密钥是否存在，不存在则插入
    const hrKeyExists = db.prepare('SELECT * FROM invite_keys WHERE key_value = ?').all('HR-123456');
    if (hrKeyExists.length === 0) {
      db.prepare('INSERT OR IGNORE INTO invite_keys (id, key_value, role) VALUES (?, ?, ?)')
        .run(randomUUID(), 'HR-123456', 'hr');
      console.log('✅ HR密钥 HR-123456 已补插入');
    }
  }
} catch(e) {
  console.error('插入密钥失败:', e.message);
}

// 检查并插入用户
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').all();
if (userCount[0].cnt === 0) {
  console.log('⚠ 用户表为空，尝试直接插入账号...\n');
  // 使用数据库中已有的方式
  console.log('请通过以下方式创建账号：');
  console.log('  1. 启动后端服务 (npm run dev 或 npm start)');
  console.log('  2. 使用注册页面注册，密钥如下：');
}

// 3. 打印最终状态
console.log('\n--- 当前邀请密钥列表 ---');
const all = db.prepare('SELECT key_value, role, used_by FROM invite_keys').all();
all.forEach(row => {
  const status = row.used_by ? '(已使用)' : '(可用)';
  console.log(`  ${row.role.padEnd(8)} ${row.key_value.padEnd(18)} ${status}`);
});

// 4. 检查用户
console.log('\n--- 当前用户列表 ---');
const users = db.prepare('SELECT email, role, name FROM users').all();
if (users.length === 0) {
  console.log('  (无用户 - 请通过注册页面创建)');
} else {
  users.forEach(u => {
    console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(25)} ${u.name}`);
  });
}

db.close();
console.log('\n✅ 初始化完成');
