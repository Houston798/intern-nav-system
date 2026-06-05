import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState } from '../components/ui/Card'

const TOTAL_STEPS = 6

// ── 步骤定义 ──
const steps = [
  { num: 1, title: '账号注册', desc: '完成注册并设置基本信息', icon: '📝' },
  { num: 2, title: 'MBTI 测评', desc: '完成性格测试，了解工作风格', icon: '🧠' },
  { num: 3, title: '部门选择', desc: '选择意向业务部门与方向', icon: '🏢' },
  { num: 4, title: '导师匹配', desc: '选择一对一导师', icon: '🤝' },
  { num: 5, title: '目标设定', desc: '制定实习目标与任务计划', icon: '🎯' },
  { num: 6, title: '入职培训', desc: '完成公司文化与制度学习', icon: '📚' },
]

// ── MBTI 题目 ──
const mbtiQuestions = [
  { id: 'ei1', text: '在社交场合中，你通常会感到精力充沛还是疲惫？', left: '精力充沛 (E)', right: '感到疲惫 (I)' },
  { id: 'ei2', text: '你更喜欢与很多人交流还是独处思考？', left: '与人交流 (E)', right: '独处思考 (I)' },
  { id: 'ei3', text: '遇到问题时，你更倾向于找人讨论还是自己先想清楚？', left: '找人讨论 (E)', right: '自己思考 (I)' },
  { id: 'sn1', text: '你更关注具体的事实细节还是抽象的概念与可能性？', left: '具体细节 (S)', right: '抽象概念 (N)' },
  { id: 'sn2', text: '学习新事物时，你更喜欢按步骤实操还是先理解整体框架？', left: '按步骤实操 (S)', right: '先看框架 (N)' },
  { id: 'sn3', text: '做决策时，你更依赖过往经验还是直觉灵感？', left: '过往经验 (S)', right: '直觉灵感 (N)' },
  { id: 'tf1', text: '面对冲突时，你更注重公平原则还是照顾他人感受？', left: '公平原则 (T)', right: '照顾感受 (F)' },
  { id: 'tf2', text: '给予反馈时，你倾向于直截了当还是委婉表达？', left: '直截了当 (T)', right: '委婉表达 (F)' },
  { id: 'tf3', text: '做重要决定时，你主要依靠逻辑分析还是内心价值观？', left: '逻辑分析 (T)', right: '内心价值观 (F)' },
  { id: 'jp1', text: '你更喜欢有计划有条理的生活还是灵活随性的安排？', left: '计划条理 (J)', right: '灵活随性 (P)' },
  { id: 'jp2', text: '面对截止日期，你会提前完成还是最后冲刺？', left: '提前完成 (J)', right: '最后冲刺 (P)' },
  { id: 'jp3', text: '旅行时，你倾向详细规划行程还是随心探索？', left: '详细规划 (J)', right: '随心探索 (P)' },
]

// ── 部门列表 ──
const departments = [
  { name: '商务', directions: ['客户拓展', '合同管理', '商务谈判'] },
  { name: '运营', directions: ['用户增长', '数据分析', '活动策划'] },
  { name: '产品', directions: ['产品设计', '需求分析', '用户研究'] },
  { name: '技术', directions: ['前端开发', '后端开发', '数据工程'] },
  { name: '市场', directions: ['品牌营销', '内容运营', '渠道推广'] },
]

// ── 培训题目 ──
const trainingQuiz = [
  { q: '公司的工作时间制度是？', opts: ['弹性工作制', '朝九晚五', '996', '大小周'], ans: 0 },
  { q: '请假需要提前多久提交申请？', opts: ['无需提前', '至少 1 天', '至少 3 天', '至少 1 周'], ans: 1 },
  { q: '报销凭证应保存多久？', opts: ['1 个月', '3 个月', '6 个月', '不需要保存'], ans: 1 },
  { q: '信息安全事件第一上报对象是？', opts: ['同事', '直属上级', '信息安全部门', 'CEO'], ans: 2 },
  { q: '公司核心价值观包括以下哪项？', opts: ['唯快不破', '用户至上', '狼性文化', '结果为王'], ans: 1 },
]

// ── MBTI 计算函数 ──
function calcMBTI(answers: Record<string, number>): string {
  const e = (answers.ei1 || 0) + (answers.ei2 || 0) + (answers.ei3 || 0)
  const s = (answers.sn1 || 0) + (answers.sn2 || 0) + (answers.sn3 || 0)
  const t = (answers.tf1 || 0) + (answers.tf2 || 0) + (answers.tf3 || 0)
  const j = (answers.jp1 || 0) + (answers.jp2 || 0) + (answers.jp3 || 0)
  return `${e >= 1.5 ? 'E' : 'I'}${s >= 1.5 ? 'S' : 'N'}${t >= 1.5 ? 'T' : 'F'}${j >= 1.5 ? 'J' : 'P'}`
}

const mbtiDescriptions: Record<string, string> = {
  INTJ: '建筑师 — 富有战略思维的独立规划者，善于长远布局',
  INTP: '逻辑学家 — 创新的分析型思考者，对知识有无限渴望',
  ENTJ: '指挥官 — 大胆果断的领袖，擅长组织与领导',
  ENTP: '辩论家 — 机智好奇的思想探索者，享受智力挑战',
  INFJ: '提倡者 — 安静神秘但富有感染力，坚持理想',
  INFP: '调停者 — 诗意善良的利他主义者，追寻生命意义',
  ENFJ: '主人公 — 富有魅力的领导者，善于激励他人',
  ENFP: '竞选者 — 热情自由的社交达人，充满创造力',
  ISTJ: '物流师 — 务实可靠，注重事实与秩序',
  ISFJ: '守卫者 — 专注奉献的守护者，默默付出',
  ESTJ: '总经理 — 出色的管理者，注重效率与规则',
  ESFJ: '执政官 — 热心体贴的社交组织者，善于照顾他人',
  ISTP: '鉴赏家 — 大胆实操的探索者，擅长解决实际问题',
  ISFP: '探险家 — 灵活迷人的艺术型人格，活在当下',
  ESTP: '企业家 — 聪明有活力的行动派，享受风险',
  ESFP: '表演者 — 自发热情的娱乐家，感染周围每一个人',
}

// ── 组件 ──
export default function Onboarding() {
  const { user, refreshOnboarding } = useAuth()
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [stepsData, setStepsData] = useState<Record<string, any>>({})

  // 各步骤状态
  const [mbtiAnswers, setMbtiAnswers] = useState<Record<string, number>>({})
  const [mbtiResult, setMbtiResult] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedDirection, setSelectedDirection] = useState('')
  const [mentors, setMentors] = useState<any[]>([])
  const [selectedMentor, setSelectedMentor] = useState('')
  const [goals, setGoals] = useState<{ text: string; timeline: string }[]>([{ text: '', timeline: '' }])
  const [quizAnswers, setQuizAnswers] = useState<number[]>(new Array(trainingQuiz.length).fill(-1))
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState(0)

  // 加载进度
  useEffect(() => {
    if (!user) return
    let c = false
    setLoading(true)
    setError('')
    api.get('/onboarding')
      .then(res => {
        if (c) return
        const d = res.data
        if (d.completed_at) {
          setAllDone(true)
          setActiveStep(6)
        } else {
          setActiveStep(d.current_step)
        }
        setStepsData(d.steps_data || {})
        if (d.steps_data?.mbti?.type) setMbtiResult(d.steps_data.mbti.type)
        if (d.steps_data?.department?.name) {
          setSelectedDept(d.steps_data.department.name)
          setSelectedDirection(d.steps_data.department.direction)
        }
        if (d.steps_data?.mentor?.id) setSelectedMentor(d.steps_data.mentor.id)
        if (d.steps_data?.goals) setGoals(d.steps_data.goals)
        if (d.steps_data?.training) {
          setQuizSubmitted(true)
          setQuizScore(d.steps_data.training.quiz_score ?? 0)
        }
      })
      .catch(() => { if (!c) setError('获取引导数据失败') })
      .finally(() => { if (!c) setLoading(false) })
    return () => { c = true }
  }, [user])

  // 加载导师列表（Step 4 使用）
  useEffect(() => {
    if (activeStep === 4 && mentors.length === 0) {
      api.get('/onboarding/mentors').then(r => setMentors(r.data.mentors)).catch(() => {})
    }
  }, [activeStep, mentors.length])

  // ── 步骤提交处理 ──
  const submitMbti = useCallback(async () => {
    if (Object.keys(mbtiAnswers).length < mbtiQuestions.length) return
    setSubmitting(true)
    try {
      const type = calcMBTI(mbtiAnswers)
      setMbtiResult(type)
      await api.post('/onboarding/mbti', { mbti_type: type, answers: mbtiAnswers })
      setActiveStep(3)
    } catch { setError('提交失败') }
    finally { setSubmitting(false) }
  }, [mbtiAnswers])

  const submitDepartment = useCallback(async () => {
    if (!selectedDept) return
    setSubmitting(true)
    try {
      await api.post('/onboarding/department', { department: selectedDept, sub_direction: selectedDirection })
      setActiveStep(4)
    } catch { setError('提交失败') }
    finally { setSubmitting(false) }
  }, [selectedDept, selectedDirection])

  const submitMentor = useCallback(async () => {
    if (!selectedMentor) return
    setSubmitting(true)
    try {
      await api.post('/onboarding/mentor', { mentor_id: selectedMentor })
      setActiveStep(5)
    } catch { setError('提交失败') }
    finally { setSubmitting(false) }
  }, [selectedMentor])

  const submitGoals = useCallback(async () => {
    const valid = goals.filter(g => g.text.trim())
    if (valid.length === 0) return
    setSubmitting(true)
    try {
      await api.post('/onboarding/goals', { goals: valid })
      setActiveStep(6)
    } catch { setError('提交失败') }
    finally { setSubmitting(false) }
  }, [goals])

  const submitTraining = useCallback(async () => {
    if (quizAnswers.includes(-1)) return
    setSubmitting(true)
    const score = quizAnswers.reduce((s, a, i) => s + (a === trainingQuiz[i].ans ? 1 : 0), 0)
    setQuizScore(score)
    setQuizSubmitted(true)
    try {
      const res = await api.post('/onboarding/training', { quiz_score: score })
      if (res.data.all_done) setAllDone(true)
    } catch { setError('提交失败') }
    finally { setSubmitting(false) }
  }, [quizAnswers])

  // ── 判断步骤状态 ──
  const isCompleted = (n: number) => allDone || n < activeStep
  const isCurrent = (n: number) => n === activeStep && !allDone
  const isLocked = (n: number) => n > activeStep && !allDone

  if (!user) return <EmptyState icon="🚀" title="请先登录" description="登录后查看入职引导进度" />
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="text-sm text-slate-400">加载入职引导...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto page-enter">
      {/* ── 左侧：步骤时间线 ── */}
      <aside className="lg:w-72 shrink-0">
        <div className="sticky top-20">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🚀</span>
            <div>
              <h2 className="text-lg font-bold text-white">入职引导</h2>
              <p className="text-xs text-slate-400">
                {allDone ? '🎉 全部完成' : `第 ${activeStep}/${TOTAL_STEPS} 步`}
              </p>
            </div>
          </div>

          {/* 进度条 */}
          <div className="mb-6">
            <div className="flex items-baseline justify-between text-xs mb-2">
              <span className="text-slate-500">总体进度</span>
              <span className="font-bold text-indigo-400">
                {allDone ? 100 : Math.round((activeStep / TOTAL_STEPS) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                style={{ width: `${allDone ? 100 : Math.round((activeStep / TOTAL_STEPS) * 100)}%` }}
              />
            </div>
          </div>

          {/* 步骤列表 */}
          <nav className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-slate-700/50" />
            {steps.map((s, i) => (
              <button
                key={s.num}
                onClick={() => {
                  if (isCompleted(s.num) || isCurrent(s.num)) setActiveStep(s.num)
                }}
                disabled={isLocked(s.num)}
                className={`relative flex items-start gap-4 w-full text-left py-3 px-1 rounded-lg transition-all ${
                  isCurrent(s.num) ? 'bg-indigo-500/10 -mx-2 px-3' : ''
                } ${isLocked(s.num) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-800/50'}`}
              >
                {/* 圆点 */}
                <span
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-all ${
                    isCompleted(s.num)
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : isCurrent(s.num)
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                      : 'border-slate-600 bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted(s.num) ? '✓' : s.icon}
                </span>
                <div className="pt-1.5">
                  <p className={`text-sm font-medium ${isCurrent(s.num) ? 'text-white' : isLocked(s.num) ? 'text-slate-500' : 'text-slate-300'}`}>
                    {s.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── 右侧：交互内容区 ── */}
      <main className="flex-1 min-w-0">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
        )}

        {/* All Done */}
        {allDone && (
          <CompletionWithIntro onStart={async () => {
            await refreshOnboarding()
            navigate('/dashboard', { replace: true })
          }} />
        )}

        {/* Step 1: 账号注册 */}
        {isCurrent(1) && !allDone && (
          <StepCard icon="📝" title="账号注册" subtitle="第一步：完成账号注册与基本信息">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-lg">✓</span>
                <div>
                  <p className="text-sm font-medium text-white">注册已完成</p>
                  <p className="text-xs text-slate-400">姓名：{user.name} · 邮箱：{user.email}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                使用公司邮箱注册确保身份可追溯，填写真实姓名以便导师和 HR 识别。账号由 HR 分发的邀请密钥激活，角色已锁定。
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setActiveStep(2)} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-sm font-semibold text-white hover:opacity-90 transition-all">
                进入下一步 →
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 2: MBTI 测评 */}
        {isCurrent(2) && !allDone && (
          <StepCard icon="🧠" title="MBTI 性格测评" subtitle="第二步：了解你的工作风格与偏好">
            {!mbtiResult ? (
              <>
                <p className="text-sm text-slate-400 mb-6">每题选择最符合你的那一侧描述（点击圆点），共有 12 道题。</p>
                <div className="space-y-5">
                  {mbtiQuestions.map((q, qi) => (
                    <div key={q.id} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-4">
                      <p className="text-sm font-medium text-white mb-3">{qi + 1}. {q.text}</p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setMbtiAnswers(prev => ({ ...prev, [q.id]: 1 }))}
                          className={`flex-1 text-center py-2.5 rounded-lg text-xs font-medium transition-all border ${
                            mbtiAnswers[q.id] === 1
                              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                              : 'border-slate-700/50 bg-slate-700/30 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          ← {q.left}
                        </button>
                        <span className="text-slate-600 text-xs shrink-0">VS</span>
                        <button
                          onClick={() => setMbtiAnswers(prev => ({ ...prev, [q.id]: 0 }))}
                          className={`flex-1 text-center py-2.5 rounded-lg text-xs font-medium transition-all border ${
                            mbtiAnswers[q.id] === 0
                              ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                              : 'border-slate-700/50 bg-slate-700/30 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {q.right} →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-slate-500">已答 {Object.keys(mbtiAnswers).length}/{mbtiQuestions.length}</span>
                  <button
                    onClick={submitMbti}
                    disabled={Object.keys(mbtiAnswers).length < mbtiQuestions.length || submitting}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      Object.keys(mbtiAnswers).length >= mbtiQuestions.length && !submitting
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? '提交中...' : '提交测评'}
                  </button>
                </div>
              </>
            ) : (
              <MBTIResult type={mbtiResult} onNext={() => setActiveStep(3)} />
            )}
          </StepCard>
        )}

        {/* Step 3: 部门选择 */}
        {isCurrent(3) && !allDone && (
          <StepCard icon="🏢" title="部门选择" subtitle="第三步：选择意向业务部门与方向">
            <p className="text-sm text-slate-400 mb-5">根据专业背景和兴趣选择部门，实习期可与导师协商调整。</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {departments.map(dept => (
                <button
                  key={dept.name}
                  onClick={() => { setSelectedDept(dept.name); setSelectedDirection('') }}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedDept === dept.name
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <p className="text-sm font-semibold text-white mb-2">{dept.name}</p>
                  {selectedDept === dept.name && (
                    <div className="mt-2 space-y-1.5">
                      {dept.directions.map(dir => (
                        <button
                          key={dir}
                          onClick={(e) => { e.stopPropagation(); setSelectedDirection(dir) }}
                          className={`block w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                            selectedDirection === dir
                              ? 'bg-indigo-500/30 text-indigo-300'
                              : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50'
                          }`}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={submitDepartment}
                disabled={!selectedDept || submitting}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  selectedDept && !submitting
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                {submitting ? '提交中...' : `确认选择${selectedDirection ? '：' + selectedDept + ' - ' + selectedDirection : ''}`}
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 4: 导师匹配 */}
        {isCurrent(4) && !allDone && (
          <StepCard icon="🤝" title="导师匹配" subtitle="第四步：选择一对一导师">
            <p className="text-sm text-slate-400 mb-5">导师将负责你的任务分配、技能培训和期满评估。请选择一位导师。</p>
            {mentors.length === 0 ? (
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-8 text-center">
                <div className="h-6 w-6 mx-auto rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mb-3" />
                <p className="text-sm text-slate-400">加载导师列表...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentors.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMentor(m.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedMentor === m.id
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50'
                        : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex h-10 w-10 rounded-full bg-indigo-500/20 items-center justify-center text-lg">
                        🧑‍🏫
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.department || '综合'} {m.mbti_type ? `· ${m.mbti_type}` : ''}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={submitMentor}
                disabled={!selectedMentor || submitting}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  selectedMentor && !submitting
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                {submitting ? '提交中...' : '确认导师'}
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 5: 目标设定 */}
        {isCurrent(5) && !allDone && (
          <StepCard icon="🎯" title="目标设定" subtitle="第五步：制定实习目标与计划">
            <p className="text-sm text-slate-400 mb-5">设定 1-5 个具体的实习目标，每个目标包含描述和时间节点。</p>
            <div className="space-y-3">
              {goals.map((g, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      value={g.text}
                      onChange={e => {
                        const next = [...goals]
                        next[i] = { ...next[i], text: e.target.value }
                        setGoals(next)
                      }}
                      placeholder={`目标 ${i + 1}：例如 - 独立完成一个功能模块的开发`}
                      className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <input
                      value={g.timeline}
                      onChange={e => {
                        const next = [...goals]
                        next[i] = { ...next[i], timeline: e.target.value }
                        setGoals(next)
                      }}
                      placeholder="时间节点：例如 - 第 4 周"
                      className="w-full bg-slate-800 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  {goals.length > 1 && (
                    <button
                      onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors mt-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => setGoals([...goals, { text: '', timeline: '' }])}
                disabled={goals.length >= 5}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-slate-600"
              >
                + 添加目标 ({goals.length}/5)
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={submitGoals}
                disabled={!goals.some(g => g.text.trim()) || submitting}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  goals.some(g => g.text.trim()) && !submitting
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                    : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                {submitting ? '提交中...' : '确认目标'}
              </button>
            </div>
          </StepCard>
        )}

        {/* Step 6: 入职培训 */}
        {isCurrent(6) && !allDone && (
          <StepCard icon="📚" title="入职培训" subtitle="第六步：完成公司文化与制度学习">
            {!quizSubmitted ? (
              <>
                {/* 培训资料 */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-5 mb-6">
                  <h4 className="text-sm font-semibold text-white mb-3">📖 培训须知</h4>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 公司采用弹性工作制，核心工作时间 10:00-16:00</li>
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 请假需提前至少 1 天通过系统提交申请</li>
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 报销凭证（发票、收据）需保存至少 3 个月</li>
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 信息安全事件（数据泄露、钓鱼邮件）第一时间上报信息安全部门</li>
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 公司核心价值观：用户至上、持续创新、团队协作</li>
                    <li className="flex gap-2"><span className="text-indigo-400 shrink-0">•</span> 公司内部沟通工具为即时消息 + 邮件，重要事项需书面留痕</li>
                  </ul>
                </div>

                {/* 测验 */}
                <h4 className="text-sm font-semibold text-white mb-4">📝 入职培训小测验（{trainingQuiz.length} 题）</h4>
                <div className="space-y-4">
                  {trainingQuiz.map((q, qi) => (
                    <div key={qi} className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-4">
                      <p className="text-sm font-medium text-white mb-3">{qi + 1}. {q.q}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.opts.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => {
                              const next = [...quizAnswers]
                              next[qi] = oi
                              setQuizAnswers(next)
                            }}
                            className={`text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
                              quizAnswers[qi] === oi
                                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                                : 'border-slate-700/50 bg-slate-700/30 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {String.fromCharCode(65 + oi)}. {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    已答 {quizAnswers.filter(a => a >= 0).length}/{trainingQuiz.length}
                  </span>
                  <button
                    onClick={submitTraining}
                    disabled={quizAnswers.includes(-1) || submitting}
                    className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      !quizAnswers.includes(-1) && !submitting
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? '提交中...' : '提交测验'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                <span className="text-4xl mb-3 block">{quizScore >= 4 ? '🎉' : '📝'}</span>
                <p className="text-lg font-bold text-white mb-1">
                  测验得分：{quizScore}/{trainingQuiz.length}
                </p>
                <p className="text-sm text-slate-400 mb-4">
                  {quizScore >= 4 ? '优秀！你对公司制度有很好的理解。' : quizScore >= 3 ? '良好！建议复习错题后重试。' : '建议重新阅读培训资料后再试。'}
                </p>
                {quizScore < 5 && (
                  <button
                    onClick={() => { setQuizSubmitted(false); setQuizAnswers(new Array(trainingQuiz.length).fill(-1)) }}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    重新测验
                  </button>
                )}
                {quizScore >= 3 && (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                    <span className="text-2xl block mb-2">🎉</span>
                    <p className="text-sm font-semibold text-white mb-1">入职引导全部完成！</p>
                    <p className="text-xs text-slate-400">上方将展示平台功能介绍，帮助你快速上手</p>
                  </div>
                )}
              </div>
            )}
          </StepCard>
        )}

        {/* 已完成但未到下一步（review 模式） */}
        {isCompleted(activeStep) && activeStep >= 2 && activeStep <= 5 && !isCurrent(activeStep) && (
          <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-8 text-center">
            <span className="text-3xl block mb-3">
              {steps[activeStep - 1]?.icon || '✅'}
            </span>
            <p className="text-white font-semibold mb-1">「{steps[activeStep - 1]?.title || ''}」已完成</p>
            <p className="text-sm text-slate-400 mb-4">点击左侧下一步骤继续入职流程</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ── 步骤卡片容器 ──
function StepCard({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-700/30 bg-slate-900/60 backdrop-blur p-5 sm:p-6 animate-fade-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── MBTI 结果展示 ──
function MBTIResult({ type, onNext }: { type: string; onNext: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
      <span className="text-4xl block mb-3">🧬</span>
      <p className="text-xs text-slate-400 mb-1">你的 MBTI 类型</p>
      <p className="text-3xl font-black tracking-widest text-white mb-2">{type}</p>
      <p className="text-sm text-slate-300 mb-4">{mbtiDescriptions[type] || '独特的性格组合'}</p>
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 mb-4">
        ✓ 已保存到你的个人档案
      </div>
      <div className="flex justify-center">
        <button onClick={onNext} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-sm font-semibold text-white hover:opacity-90 transition-all">
          进入下一步 →
        </button>
      </div>
    </div>
  )
}

// ── 完成庆祝 + 平台功能介绍 ──
function CompletionWithIntro({ onStart }: { onStart: () => void }) {
  const [showIntro, setShowIntro] = useState(false)
  const [loading, setLoading] = useState(false)

  const platformFeatures = [
    {
      icon: '📊', title: '任务看板',
      desc: '查看导师分配的任务，使用看板视图或列表视图管理待办、进行中、已完成的任务，一目了然。',
      color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/20',
    },
    {
      icon: '📅', title: '实习日历',
      desc: '在日历上直接点击日期创建任务，查看截止日期分布，按周规划你的实习进度。',
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/20',
    },
    {
      icon: '🤖', title: 'AI 助手',
      desc: '随时向 AI 助手提问，获取业务知识、代码帮助或文档撰写建议，加速你的学习曲线。',
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20',
    },
    {
      icon: '👥', title: '导师沟通',
      desc: '与导师保持高效沟通，接收反馈和指导，确保实习目标顺利推进。',
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/20',
    },
  ]

  const handleStart = async () => {
    setLoading(true)
    await onStart()
    setLoading(false)
  }

  if (!showIntro) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.02] p-8 text-center mb-6 animate-fade-slide-up">
        <div className="text-5xl mb-4 animate-bounce-in">🎉</div>
        <h3 className="text-xl font-bold text-white mb-2">入职引导全部完成！</h3>
        <p className="text-sm text-slate-400 mb-4">
          你已经完成了所有 6 个步骤，准备好开始实习之旅了吗？
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500 mb-5">
          <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> MBTI 档案</span>
          <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> 部门确认</span>
          <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> 导师匹配</span>
          <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> 目标设定</span>
          <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> 培训完成</span>
        </div>
        <button
          onClick={() => setShowIntro(true)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-sm font-semibold text-white hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20"
        >
          查看平台功能介绍 →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-slide-up">
      {/* 完成横幅 */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.02] p-6 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-lg font-bold text-white mb-1">入职引导完成</h3>
        <p className="text-xs text-slate-500">
          以下是平台的几个核心模块，帮助你快速上手
        </p>
      </div>

      {/* 功能介绍卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {platformFeatures.map((f, i) => (
          <div
            key={i}
            className={`rounded-xl border bg-gradient-to-br ${f.color} p-5 transition-all hover:scale-[1.02]`}
          >
            <span className="text-2xl block mb-3">{f.icon}</span>
            <h4 className="text-sm font-semibold text-white mb-1.5">{f.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="rounded-2xl border border-slate-700/30 bg-slate-900/60 p-6 text-center">
        <p className="text-sm text-slate-300 mb-4">
          准备好了吗？点击下方按钮开始使用平台
        </p>
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-sm font-semibold text-white hover:opacity-90 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              正在加载…
            </span>
          ) : (
            '🚀 开始使用平台'
          )}
        </button>
      </div>
    </div>
  )
}
