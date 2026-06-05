-- ═══════════════════════════════════════════════════════════
-- 实习生导航系统 — Supabase 种子数据
-- 在 Supabase SQL Editor 中执行 schema.sql 后再执行此文件
-- ═══════════════════════════════════════════════════════════

-- ── 默认邀请密钥 ────────────────────────────────────────
INSERT INTO invite_keys (id, key_value, role) VALUES
  (gen_random_uuid()::text, 'MENTOR-123456', 'mentor'),
  (gen_random_uuid()::text, 'INTERN-123456', 'intern'),
  (gen_random_uuid()::text, 'HR-123456', 'hr')
ON CONFLICT (key_value) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 技能树种子数据（5 个部门 × 3 层分类）
-- ═══════════════════════════════════════════════════════════
INSERT INTO skills (id, name, department, parent_id, category, description, resources, order_index) VALUES
-- 研发部
('sk_rd_basic','基础素养','研发',NULL,'basic','研发新人通用基础能力','["研发新人手册","技术栈全景图"]',0),
('sk_rd_git','Git 版本控制','研发','sk_rd_basic','basic','掌握 Git 分支策略、代码合并与冲突解决','["Git 教程","GitFlow 工作流"]',0),
('sk_rd_standard','代码规范','研发','sk_rd_basic','basic','学习团队编码规范与 Code Style','["团队编码规范文档"]',1),
('sk_rd_linux','Linux 基础','研发','sk_rd_basic','basic','掌握常用 Linux 命令与 Shell 脚本','["Linux 命令行入门"]',2),
('sk_rd_doc','技术文档撰写','研发','sk_rd_basic','basic','学习技术方案与 API 文档的规范写法','["技术文档写作指南"]',3),
('sk_rd_dept','部门专精','研发',NULL,'department','研发部门核心技术能力','[]',1),
('sk_rd_backend','后端开发','研发','sk_rd_dept','department','掌握 Go/Java/Python 后端开发框架','["Go 入门","Spring Boot 实战"]',0),
('sk_rd_frontend','前端开发','研发','sk_rd_dept','department','学习 React/Vue 前端开发与工程化','["React 官方文档","Vue 3 教程"]',1),
('sk_rd_db','数据库设计','研发','sk_rd_dept','department','SQL/NoSQL 数据库建模与性能优化','["MySQL 实战","Redis 入门"]',2),
('sk_rd_ut','单元测试','研发','sk_rd_dept','department','TDD 开发模式与单元测试编写','["Jest 教程","Go testing"]',3),
('sk_rd_api','API 设计','研发','sk_rd_dept','department','RESTful API 设计与 gRPC','["API 设计指南","gRPC 入门"]',4),
('sk_rd_adv','进阶业务','研发',NULL,'advanced','高阶工程能力与架构思维','[]',2),
('sk_rd_arch','系统架构设计','研发','sk_rd_adv','advanced','微服务架构、分布式系统设计','["DDIA 导读","微服务设计"]',0),
('sk_rd_perf','性能优化','研发','sk_rd_adv','advanced','性能 profiling 与优化策略','["性能优化方法论"]',1),
('sk_rd_cr','Code Review','研发','sk_rd_adv','advanced','代码审查最佳实践与技巧','["Code Review 清单"]',2),
('sk_rd_security','安全防护','研发','sk_rd_adv','advanced','常见 Web 安全漏洞与防护方案','["OWASP Top 10"]',3),
-- 产品部
('sk_pm_basic','基础素养','产品',NULL,'basic','产品新人入门必备素养','["产品思维入门","人人都是产品经理"]',0),
('sk_pm_think','产品思维','产品','sk_pm_basic','basic','建立用户价值导向的产品思维模型','["产品方法论"]',0),
('sk_pm_biz','业务分析','产品','sk_pm_basic','basic','学习如何拆解业务流程与识别痛点','["业务分析框架"]',1),
('sk_pm_write','文档撰写','产品','sk_pm_basic','basic','结构化文档表达与汇报能力','["金字塔原理"]',2),
('sk_pm_comm','沟通表达','产品','sk_pm_basic','basic','跨部门沟通与需求传递技巧','[]',3),
('sk_pm_dept','部门专精','产品',NULL,'department','产品部门核心技能','[]',1),
('sk_pm_prd','PRD 撰写','产品','sk_pm_dept','department','高质量 PRD 文档的结构与技巧','["PRD 模板","需求评审 Checklist"]',0),
('sk_pm_comp','竞品调研','产品','sk_pm_dept','department','竞品分析框架与信息收集方法','["竞品分析框架.pdf"]',1),
('sk_pm_proto','原型设计','产品','sk_pm_dept','department','使用 Figma 制作交互原型','["Figma 教程"]',2),
('sk_pm_pm','项目管理','产品','sk_pm_dept','department','敏捷开发与 JIRA/TAPD 使用','["Scrum 指南"]',3),
('sk_pm_adv','进阶业务','产品',NULL,'advanced','高阶产品能力','[]',2),
('sk_pm_growth','用户增长策略','产品','sk_pm_adv','advanced','AARRR 模型与增长实验','["增长黑客"]',0),
('sk_pm_data','数据驱动决策','产品','sk_pm_adv','advanced','用数据验证假设与驱动产品迭代','["数据产品设计"]',1),
('sk_pm_ab','A/B 测试','产品','sk_pm_adv','advanced','实验设计与统计分析基础','["A/B 测试实践"]',2),
('sk_pm_roadmap','产品规划','产品','sk_pm_adv','advanced','Roadmap 制定与优先级排序','["RICE 模型"]',3),
-- 运营部
('sk_ops_basic','基础素养','运营',NULL,'basic','运营新人基础能力','["运营新人手册"]',0),
('sk_ops_office','办公软件精通','运营','sk_ops_basic','basic','Excel/PPT 高级技巧','["Excel 高级教程"]',0),
('sk_ops_copy','文案撰写','运营','sk_ops_basic','basic','新媒体文案与营销文案写作','["文案创作指南"]',1),
('sk_ops_comm','沟通协调','运营','sk_ops_basic','basic','跨团队沟通与资源协调','[]',2),
('sk_ops_search','信息检索','运营','sk_ops_basic','basic','高效的互联网信息搜索与整理','[]',3),
('sk_ops_dept','部门专精','运营',NULL,'department','运营核心专业能力','[]',1),
('sk_ops_sql','数据查询(SQL)','运营','sk_ops_dept','department','SQL 基础查询与数据提取','["SQL 必知必会"]',0),
('sk_ops_ana','数据分析','运营','sk_ops_dept','department','Excel/Python 数据分析与可视化','["Python 数据分析"]',1),
('sk_ops_ur','用户调研','运营','sk_ops_dept','department','用户访谈、问卷设计与可用性测试','["用户访谈指南"]',2),
('sk_ops_event','活动策划','运营','sk_ops_dept','department','线上/线下活动策划与执行','["活动运营方法论"]',3),
('sk_ops_social','社群运营','运营','sk_ops_dept','department','社群拉新、活跃与转化策略','[]',4),
('sk_ops_adv','进阶业务','运营',NULL,'advanced','高阶运营策略','[]',2),
('sk_ops_growth','增长黑客','运营','sk_ops_adv','advanced','数据驱动增长的实验方法','["增长黑客实战"]',0),
('sk_ops_brand','品牌营销','运营','sk_ops_adv','advanced','品牌定位与整合营销传播','[]',1),
('sk_ops_seo','SEO/SEM','运营','sk_ops_adv','advanced','搜索引擎优化与付费推广','["SEO 入门"]',2),
('sk_ops_life','用户生命周期','运营','sk_ops_adv','advanced','用户生命周期管理与 RFM 模型','[]',3),
-- 设计部
('sk_dsgn_basic','基础素养','设计',NULL,'basic','设计新人入门素养','["设计新人手册"]',0),
('sk_dsgn_prin','设计原则','设计','sk_dsgn_basic','basic','理解亲密性、对齐、对比、重复','["写给大家看的设计书"]',0),
('sk_dsgn_color','色彩理论','设计','sk_dsgn_basic','basic','配色方案与色彩心理学','["色彩设计指南"]',1),
('sk_dsgn_type','排版基础','设计','sk_dsgn_basic','basic','字体选择与版式设计规则','[]',2),
('sk_dsgn_tool','设计工具','设计','sk_dsgn_basic','basic','Figma/Sketch 高效使用','["Figma 教程"]',3),
('sk_dsgn_dept','部门专精','设计',NULL,'department','设计核心专业技能','[]',1),
('sk_dsgn_ui','UI 设计','设计','sk_dsgn_dept','department','界面视觉设计与组件规范','["Material Design"]',0),
('sk_dsgn_ux','UX 设计','设计','sk_dsgn_dept','department','用户体验设计与交互流程','["用户体验要素"]',1),
('sk_dsgn_inter','交互设计','设计','sk_dsgn_dept','department','交互方式与转场动效设计','[]',2),
('sk_dsgn_sys','设计系统','设计','sk_dsgn_dept','department','设计系统的搭建与维护','["Design System 101"]',3),
('sk_dsgn_adv','进阶业务','设计',NULL,'advanced','高阶设计思维','[]',2),
('sk_dsgn_res','用户研究','设计','sk_dsgn_adv','advanced','定性/定量用户研究方法','["用户研究方法论"]',0),
('sk_dsgn_ut','可用性测试','设计','sk_dsgn_adv','advanced','可用性测试执行与分析','[]',1),
('sk_dsgn_brand','品牌设计','设计','sk_dsgn_adv','advanced','品牌视觉识别系统设计','[]',2),
('sk_dsgn_review','设计评审','设计','sk_dsgn_adv','advanced','设计评审流程与建设性反馈','[]',3),
-- 商务部
('sk_biz_basic','基础素养','商务',NULL,'basic','商务新人入门素养','["商务新人手册"]',0),
('sk_biz_etq','商务礼仪','商务','sk_biz_basic','basic','商务场合着装与社交礼仪','[]',0),
('sk_biz_comm','沟通技巧','商务','sk_biz_basic','basic','商务沟通与向上汇报','["商务沟通技巧"]',1),
('sk_biz_office','办公软件精通','商务','sk_biz_basic','basic','Excel/PPT/Word 高级应用','[]',2),
('sk_biz_know','行业知识','商务','sk_biz_basic','basic','了解公司业务与行业趋势','[]',3),
('sk_biz_dept','部门专精','商务',NULL,'department','商务核心专业能力','[]',1),
('sk_biz_contract','合同审阅','商务','sk_biz_dept','department','合同条款审查与风险识别','["合同法基础"]',0),
('sk_biz_visit','客户拜访','商务','sk_biz_dept','department','客户拜访流程与需求挖掘','["SPIN 销售法"]',1),
('sk_biz_ppt','PPT 汇报','商务','sk_biz_dept','department','商务汇报 PPT 制作与演示','["商务 PPT 设计"]',2),
('sk_biz_nego','商务谈判','商务','sk_biz_dept','department','谈判策略与双赢技巧','[]',3),
('sk_biz_adv','进阶业务','商务',NULL,'advanced','高阶商务能力','[]',2),
('sk_biz_partner','合作伙伴管理','商务','sk_biz_adv','advanced','合作伙伴关系的建立与维护','[]',0),
('sk_biz_mkt','市场分析','商务','sk_biz_adv','advanced','市场规模估算与竞争格局分析','[]',1),
('sk_biz_risk','项目风控','商务','sk_biz_adv','advanced','商务风险识别与控制','[]',2),
('sk_biz_en','商务英语','商务','sk_biz_adv','advanced','商务英语邮件与会议沟通','[]',3)
ON CONFLICT (id) DO NOTHING;
