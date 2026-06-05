// @ts-ignore - postgres.js 自带类型但 TS 可能找不到
import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

// ═══════════════════════════════════════════════════════════
// PostgreSQL 连接层 — 兼容 better-sqlite3 的 API
// 使用 postgres.js 包连接 Supabase PostgreSQL
// ═══════════════════════════════════════════════════════════

const DATABASE_URL = process.env.DATABASE_URL || ''

// Supabase Pooler 连接配置（serverless 友好）
const sql = postgres(DATABASE_URL, {
  prepare: false,        // PgBouncer 不支持 prepared statements
  max: 3,                // 连接池大小
  idle_timeout: 20,      // 空闲超时（秒）
  connect_timeout: 10,   // 连接超时（秒）
  transform: {
    undefined: null,     // undefined → NULL
  },
})

// ── 事务上下文（模块级变量，单线程安全）─────────────────
let currentTx: postgres.TransactionSql<{}> | null = null

// ── 占位符转换：? → $1, $2, ... ──────────────────────────
function convertPlaceholders(query: string): string {
  let i = 0
  return query.replace(/\?/g, () => `$${++i}`)
}

// ═══════════════════════════════════════════════════════════
// PreparedStatement — 模拟 better-sqlite3 的 prepare().get/all/run
// ═══════════════════════════════════════════════════════════
class PreparedStatement {
  private pgQuery: string

  constructor(query: string) {
    this.pgQuery = convertPlaceholders(query)
  }

  async get(...params: any[]): Promise<any> {
    const conn = currentTx || sql
    const result = await conn.unsafe(this.pgQuery, params)
    return result[0] || undefined
  }

  async all(...params: any[]): Promise<any[]> {
    const conn = currentTx || sql
    const result = await conn.unsafe(this.pgQuery, params)
    return [...result]
  }

  async run(...params: any[]): Promise<{ changes: number }> {
    const conn = currentTx || sql
    const result = await conn.unsafe(this.pgQuery, params)
    return { changes: result.count }
  }
}

// ═══════════════════════════════════════════════════════════
// db 对象 — 模拟 better-sqlite3 Database API
// ═══════════════════════════════════════════════════════════
export const db = {
  prepare(query: string): PreparedStatement {
    return new PreparedStatement(query)
  },

  async exec(query: string): Promise<void> {
    const conn = currentTx || sql
    await conn.unsafe(convertPlaceholders(query))
  },

  pragma(_query: string): void {
    // PostgreSQL 不需要 PRAGMA，忽略
  },

  transaction<T extends (...args: any[]) => any>(fn: T): () => Promise<ReturnType<T>> {
    return async () => {
      return await sql.begin(async (tx: any) => {
        const prevTx = currentTx
        currentTx = tx
        try {
          return await fn()
        } finally {
          currentTx = prevTx
        }
      })
    }
  },

  close(): void {
    sql.end()
  },
}

// 兼容层：pool 对象（保持旧代码兼容）
export const pool = {
  query: async (sqlStr: string, params?: any[]) => {
    const conn = currentTx || sql
    const result = params && params.length > 0
      ? await conn.unsafe(convertPlaceholders(sqlStr), params)
      : await conn.unsafe(convertPlaceholders(sqlStr))
    return { rows: result, rowCount: result.length }
  },
  exec: async (sqlStr: string) => {
    const conn = currentTx || sql
    await conn.unsafe(convertPlaceholders(sqlStr))
  },
  connect: async () => ({
    query: (sqlStr: string, params?: any[]) => pool.query(sqlStr, params),
    release: () => {},
  }),
  end: async () => { await sql.end() },
}

export default db
