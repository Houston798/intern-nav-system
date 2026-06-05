import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const dbPath = process.env.DATABASE_PATH || './intern_nav.db'
const absolutePath = path.resolve(dbPath)

export const db = new Database(absolutePath)

// Enable foreign keys for SQLite
db.pragma('foreign_keys = ON')

// ── 自动建表（幂等） ──────────────────────────────────
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
    intern_start_date TEXT,
    intern_end_date TEXT,
    mentor_id TEXT REFERENCES users(id),
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

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    parent_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
    description TEXT,
    resources TEXT DEFAULT '[]',
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skill_feedbacks (
    id TEXT PRIMARY KEY,
    intern_id TEXT NOT NULL REFERENCES users(id),
    mentor_id TEXT NOT NULL REFERENCES users(id),
    skill_id TEXT NOT NULL REFERENCES skills(id),
    content TEXT NOT NULL,
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'locked',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id)
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

  CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    current_step INTEGER DEFAULT 1,
    steps_data TEXT DEFAULT '{}',
    completed_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
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

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    receiver_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mentor_tasks (
    id TEXT PRIMARY KEY,
    intern_id TEXT NOT NULL REFERENCES users(id),
    mentor_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked','in_progress','mastered')),
    due_date TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_skill_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
    due_date TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// ── 数据库迁移：添加 users 新列 ─────────────────────
try { db.exec('ALTER TABLE users ADD COLUMN intern_start_date TEXT') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN intern_end_date TEXT') } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN mentor_id TEXT REFERENCES users(id)') } catch {}

// ── 数据库迁移：tasks 增加 department 列 ─────────────
try { db.exec('ALTER TABLE tasks ADD COLUMN department TEXT') } catch {}

// ── 数据库迁移：mentor_tasks 增加 department 列 ──────
try { db.exec('ALTER TABLE mentor_tasks ADD COLUMN department TEXT') } catch {}
try { db.exec('ALTER TABLE mentor_tasks ADD COLUMN skill_source_id TEXT REFERENCES skills(id)') } catch {}

// ── 数据库迁移：mentor_tasks 修正 category 类型（SQLite 不支持直接改 CHECK，忽略旧约束）
// 兼容处理：清空已有的错误 category 值
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mentor_tasks_new (
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
  // 检查旧表是否有数据，有则迁移
  const oldCount = db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='mentor_tasks'").get() as any
  const oldSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='mentor_tasks'").get() as any
  if (oldSchema?.sql && !oldSchema.sql.includes('department TEXT')) {
    // 旧表缺少新列，需要迁移
    db.exec(`
      INSERT OR IGNORE INTO mentor_tasks_new (id, intern_id, mentor_id, title, description, category, status, due_date, order_index, created_at, updated_at)
        SELECT id, intern_id, mentor_id, title, description, category, status, due_date, order_index, created_at, updated_at FROM mentor_tasks;
      DROP TABLE mentor_tasks;
      ALTER TABLE mentor_tasks_new RENAME TO mentor_tasks;
    `)
  }
} catch {}

// ── 数据库迁移：添加技能树新列（兼容旧表） ─────────
try { db.exec('ALTER TABLE skills ADD COLUMN parent_id TEXT REFERENCES skills(id) ON DELETE CASCADE') } catch {}
try { db.exec('ALTER TABLE skills ADD COLUMN resources TEXT DEFAULT \'[]\'') } catch {}
try { db.exec('ALTER TABLE skills ADD COLUMN order_index INTEGER DEFAULT 0') } catch {}
try { db.exec("ALTER TABLE skills ADD COLUMN category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced'))") } catch {}
// 移除旧的 UNIQUE 约束（SQLite 不支持直接 DROP，通过重建表实现）
try {
  const hasUnique = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='skills'").get() as any
  if (hasUnique?.sql?.includes('UNIQUE')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills_new (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT,
        parent_id TEXT REFERENCES skills(id) ON DELETE CASCADE,
        category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced')),
        description TEXT, resources TEXT DEFAULT '[]',
        order_index INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO skills_new (id, name, department, parent_id, category, description, resources, order_index, created_at)
        SELECT id, name, department, parent_id, COALESCE(category, 'department'), description, COALESCE(resources, '[]'), COALESCE(order_index, 0), created_at FROM skills;
      DROP TABLE skills;
      ALTER TABLE skills_new RENAME TO skills;
    `)
  }
} catch {}

// ── 保险迁移：确保 UNIQUE 迁移后 category 列一定存在 ─────
try { db.exec("ALTER TABLE skills ADD COLUMN category TEXT DEFAULT 'department' CHECK (category IN ('basic','department','advanced'))") } catch {}
// 修正 UNIQUE 迁移导致的 category=NULL 问题
try { db.exec("UPDATE skills SET category = 'department' WHERE category IS NULL OR category = '' OR category NOT IN ('basic','department','advanced')") } catch {}

// ── 插入默认技能树数据（仅当为空时，三层分类结构） ────
const skillCount = db.prepare('SELECT COUNT(*) as cnt FROM skills').get() as any
if (skillCount.cnt === 0) {
  const insert = db.prepare(
    'INSERT INTO skills (id, name, department, parent_id, category, description, resources, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const res = (r: string[]) => JSON.stringify(r)
  // 分类标签: B=基础素养, D=部门专精, A=进阶业务

  const tree: [string, string, string, string|null, string, string, string, number][] = [
    // ═══════ 研发部 ═══════
    ['sk_rd_basic',   '基础素养',       '研发', null,           'basic',      '研发新人通用基础能力', res(['研发新人手册', '技术栈全景图']), 0],
    ['sk_rd_git',     'Git 版本控制',   '研发', 'sk_rd_basic', 'basic',      '掌握 Git 分支策略、代码合并与冲突解决', res(['Git 教程', 'GitFlow 工作流']), 0],
    ['sk_rd_standard','代码规范',       '研发', 'sk_rd_basic', 'basic',      '学习团队编码规范与 Code Style', res(['团队编码规范文档']), 1],
    ['sk_rd_linux',   'Linux 基础',     '研发', 'sk_rd_basic', 'basic',      '掌握常用 Linux 命令与 Shell 脚本', res(['Linux 命令行入门']), 2],
    ['sk_rd_doc',     '技术文档撰写',   '研发', 'sk_rd_basic', 'basic',      '学习技术方案与 API 文档的规范写法', res(['技术文档写作指南']), 3],
    ['sk_rd_dept',    '部门专精',       '研发', null,           'department', '研发部门核心技术能力', res([]), 1],
    ['sk_rd_backend', '后端开发',       '研发', 'sk_rd_dept',  'department', '掌握 Go/Java/Python 后端开发框架', res(['Go 入门', 'Spring Boot 实战']), 0],
    ['sk_rd_frontend','前端开发',       '研发', 'sk_rd_dept',  'department', '学习 React/Vue 前端开发与工程化', res(['React 官方文档', 'Vue 3 教程']), 1],
    ['sk_rd_db',      '数据库设计',     '研发', 'sk_rd_dept',  'department', 'SQL/NoSQL 数据库建模与性能优化', res(['MySQL 实战', 'Redis 入门']), 2],
    ['sk_rd_ut',      '单元测试',       '研发', 'sk_rd_dept',  'department', 'TDD 开发模式与单元测试编写', res(['Jest 教程', 'Go testing']), 3],
    ['sk_rd_api',     'API 设计',       '研发', 'sk_rd_dept',  'department', 'RESTful API 设计与 gRPC', res(['API 设计指南', 'gRPC 入门']), 4],
    ['sk_rd_adv',     '进阶业务',       '研发', null,           'advanced',   '高阶工程能力与架构思维', res([]), 2],
    ['sk_rd_arch',    '系统架构设计',   '研发', 'sk_rd_adv',   'advanced',   '微服务架构、分布式系统设计', res(['DDIA 导读', '微服务设计']), 0],
    ['sk_rd_perf',    '性能优化',       '研发', 'sk_rd_adv',   'advanced',   '性能 profiling 与优化策略', res(['性能优化方法论']), 1],
    ['sk_rd_cr',      'Code Review',    '研发', 'sk_rd_adv',   'advanced',   '代码审查最佳实践与技巧', res(['Code Review 清单']), 2],
    ['sk_rd_security','安全防护',       '研发', 'sk_rd_adv',   'advanced',   '常见 Web 安全漏洞与防护方案', res(['OWASP Top 10']), 3],

    // ═══════ 产品部 ═══════
    ['sk_pm_basic',   '基础素养',       '产品', null,           'basic',      '产品新人入门必备素养', res(['产品思维入门', '人人都是产品经理']), 0],
    ['sk_pm_think',   '产品思维',       '产品', 'sk_pm_basic', 'basic',      '建立用户价值导向的产品思维模型', res(['产品方法论']), 0],
    ['sk_pm_biz',     '业务分析',       '产品', 'sk_pm_basic', 'basic',      '学习如何拆解业务流程与识别痛点', res(['业务分析框架']), 1],
    ['sk_pm_write',   '文档撰写',       '产品', 'sk_pm_basic', 'basic',      '结构化文档表达与汇报能力', res(['金字塔原理']), 2],
    ['sk_pm_comm',    '沟通表达',       '产品', 'sk_pm_basic', 'basic',      '跨部门沟通与需求传递技巧', res([]), 3],
    ['sk_pm_dept',    '部门专精',       '产品', null,           'department', '产品部门核心技能', res([]), 1],
    ['sk_pm_prd',     'PRD 撰写',      '产品', 'sk_pm_dept',  'department', '高质量 PRD 文档的结构与技巧', res(['PRD 模板', '需求评审 Checklist']), 0],
    ['sk_pm_comp',    '竞品调研',       '产品', 'sk_pm_dept',  'department', '竞品分析框架与信息收集方法', res(['竞品分析框架.pdf']), 1],
    ['sk_pm_proto',   '原型设计',       '产品', 'sk_pm_dept',  'department', '使用 Figma 制作交互原型', res(['Figma 教程']), 2],
    ['sk_pm_pm',      '项目管理',       '产品', 'sk_pm_dept',  'department', '敏捷开发与 JIRA/TAPD 使用', res(['Scrum 指南']), 3],
    ['sk_pm_adv',     '进阶业务',       '产品', null,           'advanced',   '高阶产品能力', res([]), 2],
    ['sk_pm_growth',  '用户增长策略',   '产品', 'sk_pm_adv',   'advanced',   'AARRR 模型与增长实验', res(['增长黑客']), 0],
    ['sk_pm_data',    '数据驱动决策',   '产品', 'sk_pm_adv',   'advanced',   '用数据验证假设与驱动产品迭代', res(['数据产品设计']), 1],
    ['sk_pm_ab',      'A/B 测试',       '产品', 'sk_pm_adv',   'advanced',   '实验设计与统计分析基础', res(['A/B 测试实践']), 2],
    ['sk_pm_roadmap', '产品规划',       '产品', 'sk_pm_adv',   'advanced',   'Roadmap 制定与优先级排序', res(['RICE 模型']), 3],

    // ═══════ 运营部 ═══════
    ['sk_ops_basic',  '基础素养',       '运营', null,           'basic',      '运营新人基础能力', res(['运营新人手册']), 0],
    ['sk_ops_office', '办公软件精通',   '运营', 'sk_ops_basic','basic',      'Excel/PPT 高级技巧', res(['Excel 高级教程']), 0],
    ['sk_ops_copy',   '文案撰写',       '运营', 'sk_ops_basic','basic',      '新媒体文案与营销文案写作', res(['文案创作指南']), 1],
    ['sk_ops_comm',   '沟通协调',       '运营', 'sk_ops_basic','basic',      '跨团队沟通与资源协调', res([]), 2],
    ['sk_ops_search', '信息检索',       '运营', 'sk_ops_basic','basic',      '高效的互联网信息搜索与整理', res([]), 3],
    ['sk_ops_dept',   '部门专精',       '运营', null,           'department', '运营核心专业能力', res([]), 1],
    ['sk_ops_sql',    '数据查询(SQL)',  '运营', 'sk_ops_dept', 'department', 'SQL 基础查询与数据提取', res(['SQL 必知必会']), 0],
    ['sk_ops_ana',    '数据分析',       '运营', 'sk_ops_dept', 'department', 'Excel/Python 数据分析与可视化', res(['Python 数据分析']), 1],
    ['sk_ops_ur',     '用户调研',       '运营', 'sk_ops_dept', 'department', '用户访谈、问卷设计与可用性测试', res(['用户访谈指南']), 2],
    ['sk_ops_event',  '活动策划',       '运营', 'sk_ops_dept', 'department', '线上/线下活动策划与执行', res(['活动运营方法论']), 3],
    ['sk_ops_social', '社群运营',       '运营', 'sk_ops_dept', 'department', '社群拉新、活跃与转化策略', res([]), 4],
    ['sk_ops_adv',    '进阶业务',       '运营', null,           'advanced',   '高阶运营策略', res([]), 2],
    ['sk_ops_growth', '增长黑客',       '运营', 'sk_ops_adv',  'advanced',   '数据驱动增长的实验方法', res(['增长黑客实战']), 0],
    ['sk_ops_brand',  '品牌营销',       '运营', 'sk_ops_adv',  'advanced',   '品牌定位与整合营销传播', res([]), 1],
    ['sk_ops_seo',    'SEO/SEM',        '运营', 'sk_ops_adv',  'advanced',   '搜索引擎优化与付费推广', res(['SEO 入门']), 2],
    ['sk_ops_life',   '用户生命周期',   '运营', 'sk_ops_adv',  'advanced',   '用户生命周期管理与 RFM 模型', res([]), 3],

    // ═══════ 设计部 ═══════
    ['sk_dsgn_basic', '基础素养',       '设计', null,           'basic',      '设计新人入门素养', res(['设计新人手册']), 0],
    ['sk_dsgn_prin',  '设计原则',       '设计', 'sk_dsgn_basic','basic',     '理解亲密性、对齐、对比、重复', res(['写给大家看的设计书']), 0],
    ['sk_dsgn_color', '色彩理论',       '设计', 'sk_dsgn_basic','basic',     '配色方案与色彩心理学', res(['色彩设计指南']), 1],
    ['sk_dsgn_type',  '排版基础',       '设计', 'sk_dsgn_basic','basic',     '字体选择与版式设计规则', res([]), 2],
    ['sk_dsgn_tool',  '设计工具',       '设计', 'sk_dsgn_basic','basic',     'Figma/Sketch 高效使用', res(['Figma 教程']), 3],
    ['sk_dsgn_dept',  '部门专精',       '设计', null,           'department', '设计核心专业技能', res([]), 1],
    ['sk_dsgn_ui',    'UI 设计',        '设计', 'sk_dsgn_dept', 'department','界面视觉设计与组件规范', res(['Material Design']), 0],
    ['sk_dsgn_ux',    'UX 设计',        '设计', 'sk_dsgn_dept', 'department','用户体验设计与交互流程', res(['用户体验要素']), 1],
    ['sk_dsgn_inter', '交互设计',       '设计', 'sk_dsgn_dept', 'department','交互方式与转场动效设计', res([]), 2],
    ['sk_dsgn_sys',   '设计系统',       '设计', 'sk_dsgn_dept', 'department','设计系统的搭建与维护', res(['Design System 101']), 3],
    ['sk_dsgn_adv',   '进阶业务',       '设计', null,           'advanced',   '高阶设计思维', res([]), 2],
    ['sk_dsgn_res',   '用户研究',       '设计', 'sk_dsgn_adv',  'advanced',  '定性/定量用户研究方法', res(['用户研究方法论']), 0],
    ['sk_dsgn_ut',    '可用性测试',     '设计', 'sk_dsgn_adv',  'advanced',  '可用性测试执行与分析', res([]), 1],
    ['sk_dsgn_brand', '品牌设计',       '设计', 'sk_dsgn_adv',  'advanced',  '品牌视觉识别系统设计', res([]), 2],
    ['sk_dsgn_review','设计评审',       '设计', 'sk_dsgn_adv',  'advanced',  '设计评审流程与建设性反馈', res([]), 3],

    // ═══════ 商务部 ═══════
    ['sk_biz_basic',  '基础素养',       '商务', null,           'basic',      '商务新人入门素养', res(['商务新人手册']), 0],
    ['sk_biz_etq',    '商务礼仪',       '商务', 'sk_biz_basic','basic',      '商务场合着装与社交礼仪', res([]), 0],
    ['sk_biz_comm',   '沟通技巧',       '商务', 'sk_biz_basic','basic',      '商务沟通与向上汇报', res(['商务沟通技巧']), 1],
    ['sk_biz_office', '办公软件精通',   '商务', 'sk_biz_basic','basic',      'Excel/PPT/Word 高级应用', res([]), 2],
    ['sk_biz_know',   '行业知识',       '商务', 'sk_biz_basic','basic',      '了解公司业务与行业趋势', res([]), 3],
    ['sk_biz_dept',   '部门专精',       '商务', null,           'department', '商务核心专业能力', res([]), 1],
    ['sk_biz_contract','合同审阅',      '商务', 'sk_biz_dept', 'department', '合同条款审查与风险识别', res(['合同法基础']), 0],
    ['sk_biz_visit',  '客户拜访',       '商务', 'sk_biz_dept', 'department', '客户拜访流程与需求挖掘', res(['SPIN 销售法']), 1],
    ['sk_biz_ppt',    'PPT 汇报',       '商务', 'sk_biz_dept', 'department', '商务汇报 PPT 制作与演示', res(['商务 PPT 设计']), 2],
    ['sk_biz_nego',   '商务谈判',       '商务', 'sk_biz_dept', 'department', '谈判策略与双赢技巧', res([]), 3],
    ['sk_biz_adv',    '进阶业务',       '商务', null,           'advanced',   '高阶商务能力', res([]), 2],
    ['sk_biz_partner','合作伙伴管理',   '商务', 'sk_biz_adv',  'advanced',   '合作伙伴关系的建立与维护', res([]), 0],
    ['sk_biz_mkt',    '市场分析',       '商务', 'sk_biz_adv',  'advanced',   '市场规模估算与竞争格局分析', res([]), 1],
    ['sk_biz_risk',   '项目风控',       '商务', 'sk_biz_adv',  'advanced',   '商务风险识别与控制', res([]), 2],
    ['sk_biz_en',     '商务英语',       '商务', 'sk_biz_adv',  'advanced',   '商务英语邮件与会议沟通', res([]), 3],
  ]

  for (const s of tree) insert.run(...s)
  console.log('[DB] Inserted three-tier seed skills for 5 departments')
}

// Wrapper to match postgres-like interface for compatibility
export const pool = {
  query: (sql: string, params?: any[]) => {
    try {
      const stmt = db.prepare(sql)
      if (params && params.length > 0) {
        const result = stmt.all(...params)
        return { rows: result, rowCount: result.length }
      }
      const result = stmt.all()
      return { rows: result, rowCount: result.length }
    } catch (error) {
      console.error('Query error:', error)
      throw error
    }
  },
  exec: (sql: string) => {
    try {
      db.exec(sql)
    } catch (error) {
      console.error('Exec error:', error)
      throw error
    }
  },
  connect: async () => ({
    query: (sql: string, params?: any[]) => pool.query(sql, params),
    release: () => {},
  }),
  end: async () => db.close(),
}

export default db
