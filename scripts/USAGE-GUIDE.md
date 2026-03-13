# Agent Configuration - Quick Start Guide

## 🎯 目标

为 9 个角色配置完整的 Heartbeat、Soul、Tools、Skills、Memory。

## 📋 角色列表

1. CEO总指挥 (121)
2. 测试 (127)
3. 设计 (123)
4. IOS (125)
5. 运营 (128)
6. 产品 (122)
7. 前端 (124)
8. 安卓 (126)
9. JAVA (119)

## 🚀 快速开始（推荐方法）

### Step 1: 创建 Agents

在 UI 中创建 9 个 Agent，名称必须完全匹配上面的列表。

### Step 2: 运行配置脚本

```bash
# 直接数据库访问（最简单）
node scripts/seed-db-direct.mjs
```

### Step 3: 配置 Heartbeat

在 UI 中为每个 Agent 配置 Heartbeat（Agent Detail 页面 → Heartbeat 标签）：

**推荐配置：**
- CEO总指挥: 300秒（5分钟）
- 其他角色: 600秒（10分钟）

**所有 Agent 启用：**
- ✓ Heartbeat on interval
- ✓ Wake on demand
- Cooldown: 10秒
- Max concurrent runs: 1

### Step 4: 配置 Capabilities

在 UI 中为每个 Agent 配置 Capabilities（Agent Configure 页面 → Identity 部分）。

复制以下 JSON 到对应的 Agent：

#### CEO总指挥
```json
{
  "languages": ["中文", "English"],
  "frameworks": ["项目管理", "敏捷开发", "Scrum"],
  "domains": ["项目管理", "团队协调", "资源分配", "风险管理", "决策制定", "战略规划"],
  "tools": ["Jira", "Confluence", "Slack", "钉钉", "飞书"],
  "customTags": ["领导力", "跨部门协作", "全局视角", "优先级管理"]
}
```

#### 测试
```json
{
  "languages": ["Python", "Java", "JavaScript"],
  "frameworks": ["Selenium", "Appium", "JUnit", "TestNG", "Pytest", "Jest"],
  "domains": ["测试", "质量保证", "自动化测试", "性能测试", "安全测试", "bug追踪"],
  "tools": ["Postman", "JMeter", "Charles", "Fiddler", "Jenkins", "Git"],
  "customTags": ["QA", "测试用例", "缺陷管理", "测试报告", "质量把控"]
}
```

#### 设计
```json
{
  "languages": ["中文", "English"],
  "frameworks": ["UI设计", "UX设计", "视觉设计", "交互设计", "设计系统"],
  "domains": ["UI设计", "UX设计", "视觉设计", "交互设计", "品牌设计", "图标设计"],
  "tools": ["Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator", "Principle", "蓝湖"],
  "customTags": ["设计规范", "组件库", "设计评审", "用户体验", "视觉一致性"]
}
```

#### IOS
```json
{
  "languages": ["Swift", "Objective-C", "C++"],
  "frameworks": ["UIKit", "SwiftUI", "Combine", "CoreData", "Alamofire", "SnapKit"],
  "domains": ["iOS开发", "移动端", "客户端", "UI/UX实现", "性能优化"],
  "tools": ["Xcode", "CocoaPods", "Swift Package Manager", "TestFlight", "Instruments"],
  "customTags": ["iOS", "移动开发", "Apple生态", "App Store"]
}
```

#### 运营
```json
{
  "languages": ["中文", "English"],
  "frameworks": ["数据分析", "用户增长", "运营策略"],
  "domains": ["用户运营", "内容运营", "活动运营", "数据分析", "增长黑客", "用户留存"],
  "tools": ["Google Analytics", "数据分析工具", "CRM", "营销自动化", "A/B测试"],
  "customTags": ["用户增长", "数据驱动", "转化优化", "用户体验"]
}
```

#### 产品
```json
{
  "languages": ["中文", "English"],
  "frameworks": ["产品设计", "用户研究", "需求分析", "原型设计"],
  "domains": ["产品管理", "需求分析", "用户体验", "产品规划", "竞品分析", "数据分析"],
  "tools": ["Axure", "Figma", "Sketch", "墨刀", "Xmind", "Jira", "Confluence"],
  "customTags": ["产品经理", "PRD", "用户故事", "产品迭代", "需求优先级"]
}
```

#### 前端
```json
{
  "languages": ["JavaScript", "TypeScript", "HTML", "CSS", "SCSS"],
  "frameworks": ["React", "Vue", "Next.js", "Vite", "Tailwind CSS", "Ant Design"],
  "domains": ["前端开发", "Web开发", "响应式设计", "性能优化", "组件开发"],
  "tools": ["npm", "webpack", "vite", "git", "Chrome DevTools", "ESLint", "Prettier"],
  "customTags": ["前端工程化", "组件化", "状态管理", "浏览器兼容"]
}
```

#### 安卓
```json
{
  "languages": ["Kotlin", "Java", "C++"],
  "frameworks": ["Android SDK", "Jetpack", "Retrofit", "Room", "Dagger", "Compose"],
  "domains": ["Android开发", "移动端", "客户端", "UI实现", "性能优化"],
  "tools": ["Android Studio", "Gradle", "ADB", "Git", "Firebase", "LeakCanary"],
  "customTags": ["Android", "移动开发", "Google Play", "Material Design"]
}
```

#### JAVA
```json
{
  "languages": ["Java", "Kotlin", "SQL", "Groovy"],
  "frameworks": ["Spring Boot", "Spring Cloud", "MyBatis", "Hibernate", "Maven", "Gradle"],
  "domains": ["后端开发", "服务端", "API开发", "微服务", "数据库设计", "系统架构"],
  "tools": ["IntelliJ IDEA", "Maven", "Gradle", "Git", "Docker", "Jenkins", "MySQL", "Redis"],
  "customTags": ["后端", "微服务", "RESTful API", "数据库", "分布式系统"]
}
```

## ✅ 验证

配置完成后，检查：

1. **Soul**: Agent Detail → Soul 标签，应该看到系统提示词
2. **Tools**: Agent Detail → Tools 标签，应该看到工具列表
3. **Skills**: Agent Detail → Skills 标签，应该看到技能列表
4. **Memory**: Agent Detail → Memory 标签，应该看到记忆条目
5. **Heartbeat**: Agent Detail → Heartbeat 标签，应该看到配置和运行历史
6. **Capabilities**: Agent Configure → Identity，应该看到 JSON 配置

## 📁 相关文件

- `scripts/seed-db-direct.mjs` - 直接数据库访问（推荐）
- `scripts/seed-agents-via-api.mjs` - 通过 API 访问
- `scripts/seed-agent-configs-compact.sql` - SQL 脚本
- `scripts/agent-configs-data.mjs` - 配置数据
- `scripts/README-agent-configs.md` - 详细文档

## 🆘 故障排除

### Agent 未找到
确保 Agent 名称完全匹配（区分大小写）。

### 脚本执行失败
1. 检查数据库连接
2. 确保 packages/db 已编译：`pnpm -r build`
3. 查看详细错误信息

### Capabilities 保存失败
1. 确保 JSON 格式正确
2. 刷新浏览器（Cmd+Shift+R）
3. 检查浏览器控制台错误

## 💡 提示

- 建议先在测试环境运行
- 配置前备份数据库
- 脚本是幂等的，可以重复运行
- Soul 会被替换，Tools/Skills/Memory 会追加
