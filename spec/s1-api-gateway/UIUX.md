# SPEC-102 UI/UX 设计规范 - JiGongOpc-Java

> 版本：v2.0 | 日期：2026-03-14 | 优先级：P0
>
> **合并说明**：本文档合并了 SPEC-102（UI/UX 设计规范）和 SPEC-110（UI 详细设计规范），并扩展了后台管理端、Web 端、移动端 H5、桌面端、客户端的设计规范。

---

## 一、设计哲学

UI 是**专业级控制平面**，不是玩具仪表板。它应该是你每天使用的工具——快速、键盘驱动、信息密集但不杂乱、默认深色主题。每个像素都应该有其存在的价值。

### 1.1 核心原则

| 原则 | 说明 | 实现方式 |
|------|------|----------|
| **目的优先** | 每个页面有明确的单一目的 | 避免多功能混杂 |
| **层次分明** | 一个主导视觉区域，次要区域从属 | 视觉权重分明 |
| **渐进披露** | 逐步展示复杂度 | 按需展开 |
| **状态可见** | 系统状态始终可见 | 实时反馈 |
| **反馈及时** | 每个操作都有明确反馈 | Toast/动画 |
| **密集但可扫描** | 显示最大信息量，无需点击揭示 | 使用留白分隔，不是留白填充 |
| **键盘优先** | 全局快捷键搜索、新建、导航 | Cmd+K 搜索、C 新建任务 |
| **上下文化，非模态化** | 内联编辑优于对话框 | 下拉框优于页面跳转 |
| **问题可见，不隐藏** | 审计和可见性优先 | 不自动恢复，让人类决定 |

### 1.2 设计价值观

- **企业级**：专业、可靠、高效
- **数据驱动**：信息清晰、数据可视化
- **简洁**：少即是多，避免装饰性元素
- **一致**：全系统统一的视觉语言

---

## 二、统一颜色系统

### 2.1 设计系统色板（HSL）

所有端统一使用 HSL 色值系统，确保视觉一致性。

#### 2.1.1 基础色板

```css
/* 深色主题（默认） */
:root.dark {
  /* 背景色 */
  --bg-primary: hsl(220, 13%, 10%);      /* 深炭灰，非纯黑 */
  --bg-surface: hsl(220, 13%, 13%);      /* 卡片/表面 */
  --bg-elevated: hsl(220, 13%, 16%);     /*  elevated 表面 */
  --bg-border: hsl(220, 10%, 18%);       /* 边框 */
  --bg-hover: hsl(220, 10%, 20%);        /* 悬停状态 */

  /* 文字色 */
  --text-primary: hsl(220, 10%, 90%);    /* 主文字 */
  --text-secondary: hsl(220, 10%, 55%);  /* 次要文字/元数据 */
  --text-disabled: hsl(220, 10%, 35%);   /* 禁用文字 */
  --text-inverse: hsl(220, 13%, 10%);    /* 反色文字（深色背景上） */

  /* 强调色（交互元素） */
  --accent: hsl(220, 80%, 60%);          /* 柔和蓝色 */
  --accent-hover: hsl(220, 80%, 65%);    /* 强调色悬停 */
  --accent-active: hsl(220, 80%, 55%);   /* 强调色激活 */
}

/* 浅色主题 */
:root.light {
  /* 背景色 */
  --bg-primary: hsl(220, 10%, 98%);      /* 浅灰白 */
  --bg-surface: hsl(220, 10%, 100%);     /* 纯白表面 */
  --bg-elevated: hsl(220, 10%, 100%);    /* elevated 表面 */
  --bg-border: hsl(220, 10%, 88%);       /* 边框 */
  --bg-hover: hsl(220, 10%, 94%);        /* 悬停状态 */

  /* 文字色 */
  --text-primary: hsl(220, 10%, 15%);    /* 主文字 */
  --text-secondary: hsl(220, 10%, 45%);  /* 次要文字/元数据 */
  --text-disabled: hsl(220, 10%, 70%);   /* 禁用文字 */
  --text-inverse: hsl(220, 10%, 98%);    /* 反色文字（浅色背景上） */

  /* 强调色（交互元素） */
  --accent: hsl(220, 80%, 50%);          /* 柔和蓝色 */
  --accent-hover: hsl(220, 80%, 45%);    /* 强调色悬停 */
  --accent-active: hsl(220, 80%, 55%);   /* 强调色激活 */
}
```

### 2.2 状态颜色

所有实体统一的状态颜色（深色主题）：

| 状态 | HSL 色值 | Hex 值 | 说明 |
|------|----------|--------|------|
| Backlog | `hsl(220, 10%, 45%)` | #656f7a | 灰色 |
| Todo | `hsl(220, 20%, 55%)` | #6b8bcc | 灰蓝色 |
| In Progress | `hsl(45, 90%, 55%)` | #e6c84a | 黄色 |
| In Review | `hsl(270, 60%, 60%)` | #a66efa | 紫色 |
| Done | `hsl(140, 60%, 50%)` | #42c96d | 绿色 |
| Cancelled | `hsl(220, 10%, 40%)` | #5a626e | 灰色 |
| Blocked | `hsl(25, 90%, 55%)` | #e67a4a | 琥珀色 |

### 2.3 优先级指示器

| 优先级 | 图标 | HSL 色值 | 说明 |
|--------|------|----------|------|
| Critical | 🔴 实心红圆 | `hsl(0, 80%, 55%)` | 紧急 |
| High | 🟠 半填充橙圆 | `hsl(25, 90%, 55%)` | 高 |
| Medium | 🟡 黄色轮廓圆 | `hsl(45, 90%, 55%)` | 中 |
| Low | ⚪ 灰色虚线轮廓圆 | `hsl(220, 10%, 45%)` | 低 |

### 2.4 Element Plus 主题映射

将设计系统颜色映射到 Element Plus Token：

```css
/* 深色主题 Element Plus 覆盖 */
:root.dark {
  --el-bg-color: #1a1d26;              /* 对应 bg-primary */
  --el-bg-color-page: #13151a;         /* 对应页面背景 */
  --el-bg-color-overlay: #1f232e;      /* 对应 bg-surface */
  --el-border-color: #2d3342;          /* 对应 bg-border */
  --el-border-color-light: #3a4152;    /* 浅色边框 */
  --el-text-color-primary: #e8e8e8;    /* 对应 text-primary */
  --el-text-color-regular: #8a8f99;    /* 对应 text-secondary */
  --el-text-color-secondary: #5a626e;  /* 对应 text-disabled */
  --el-color-primary: #4a8eff;         /* 对应 accent */
  --el-color-primary-light-3: #6a9eff; /* 强调色浅 */
  --el-color-primary-dark: #3a7eff;    /* 强调色深 */

  /* 状态颜色映射 */
  --el-color-success: #42c96d;         /* Done */
  --el-color-warning: #e6c84a;         /* In Progress */
  --el-color-danger: #f56c6c;          /* Critical/Blocked */
  --el-color-info: #8a8f99;            /* Backlog */
}

/* 浅色主题 Element Plus 覆盖 */
:root.light {
  --el-bg-color: #f5f7fa;              /* 对应 bg-primary */
  --el-bg-color-page: #ffffff;         /* 对应页面背景 */
  --el-bg-color-overlay: #ffffff;      /* 对应 bg-surface */
  --el-border-color: #dcdfe6;          /* 对应 bg-border */
  --el-border-color-light: #e4e7ed;    /* 浅色边框 */
  --el-text-color-primary: #262b33;    /* 对应 text-primary */
  --el-text-color-regular: #606266;    /* 对应 text-secondary */
  --el-text-color-secondary: #909399;  /* 对应 text-disabled */
  --el-color-primary: #409eff;         /* 对应 accent */
  --el-color-primary-light-3: #79bbff; /* 强调色浅 */
  --el-color-primary-dark: #337ecc;    /* 强调色深 */

  /* 状态颜色映射 */
  --el-color-success: #67c23a;         /* Done */
  --el-color-warning: #e6a23c;         /* In Progress */
  --el-color-danger: #f56c6c;          /* Critical/Blocked */
  --el-color-info: #909399;            /* Backlog */
}
```

### 2.5 Saber 3 主题配置

```javascript
// src/config/theme.js
export const darkTheme = {
  colors: {
    primary: '#4a8eff',
    success: '#42c96d',
    warning: '#e6c84a',
    danger: '#f56c6c',
    info: '#8a8f99',
    bgPrimary: '#1a1d26',
    bgSurface: '#1f232e',
    bgBorder: '#2d3342',
    textPrimary: '#e8e8e8',
    textSecondary: '#8a8f99',
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};

export const lightTheme = {
  colors: {
    primary: '#409eff',
    success: '#67c23a',
    warning: '#e6a23c',
    danger: '#f56c6c',
    info: '#909399',
    bgPrimary: '#f5f7fa',
    bgSurface: '#ffffff',
    bgBorder: '#dcdfe6',
    textPrimary: '#262b33',
    textSecondary: '#606266',
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};
```

---

## 三、字体系统

### 3.1 字体族

```css
/* 系统字体栈 */
:root {
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                      'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
  /* 如果加载 Inter，则使用 Inter */
  --font-family-mono: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
}
```

### 3.2 字号规范（Web 端）

| 用途 | 字号 | 行高 | 字重 | CSS 变量 |
|------|------|------|------|----------|
| 页面标题 | 18px | 1.4 | 600 | `--text-xl` |
| 区块标题 | 16px | 1.5 | 600 | `--text-lg` |
| 正文 | 13px | 1.5 | 400 | `--text-base` |
| 标签/元数据 | 11px | 1.5 | 400 | `--text-sm` |
| 小字 | 10px | 1.4 | 400 | `--text-xs` |

**注意**：Element Plus 默认字号为 14px，需要覆盖为 13px 以符合规范。

### 3.3 字号规范（移动端）

| 用途 | 字号 | 行高 | 字重 |
|------|------|------|------|
| 页面标题 | 20px | 1.4 | 600 |
| 区块标题 | 17px | 1.5 | 600 |
| 正文 | 15px | 1.5 | 400 |
| 辅助文字 | 13px | 1.5 | 400 |
| 小字 | 12px | 1.4 | 400 |

### 3.4 字重规范

| 字重 | 值 | 用途 |
|------|-----|------|
| Regular | 400 | 正文 |
| Medium | 500 | 强调文字 |
| Semibold | 600 | 标题 |
| Bold | 700 | 重要标题 |

---

## 四、图标系统

### 4.1 图标库

| 端 | 图标库 | 引入方式 |
|----|--------|----------|
| Web 端 | Lucide Icons | `npm install lucide-vue-next` |
| Saber 3 | Element Plus Icons | `@element-plus/icons-vue` |
| 移动端 | uView UI Icons | 内置 |
| 桌面端 | Lucide Icons | 同 Web 端 |

### 4.2 侧边栏图标映射（Web 端）

| 导航项 | 图标组件 | 尺寸 |
|--------|----------|------|
| Inbox | `Inbox` | 16px |
| My Issues | `CircleUser` | 16px |
| Issues | `CircleDot` | 16px |
| Projects | `Hexagon` | 16px |
| Goals | `Target` | 16px |
| Views | `LayoutList` | 16px |
| Dashboard | `LayoutDashboard` | 16px |
| Org Chart | `GitBranch` | 16px |
| Agents | `Bot` | 16px |
| Costs | `DollarSign` | 16px |
| Activity | `History` | 16px |

### 4.3 图标使用规范

- 侧边栏导航图标：16px
- 内联图标：14px
- 按钮图标：16px
- 所有导航项必须有图标
- 图标与文字间距：8px

---

## 五、间距系统

### 5.1 4px 基准网格

所有间距基于 4px 倍数：

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 5.2 常用间距

| 用途 | 间距值 | 说明 |
|------|--------|------|
| 页面边距 | 24px-32px | 主内容区域 |
| 卡片内边距 | 24px | 标准卡片 |
| 字段间距 | 16px | 表单字段间 |
| 按钮间距 | 12px | 按钮组间 |
| 图标间距 | 8px | 图标与文字间 |
| 列表项间距 | 16px | 列表项间 |

---

## 六、各端布局规范

### 6.1 后台管理端（Saber 3）

#### 6.1.1 整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│                        Top Bar (64px)                           │
│  Logo + 系统名 | 导航菜单 | 搜索 | 通知 | 用户头像 │ 设置     │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ Sidebar  │                   Main Content                       │
│ (240px)  │                   (flex-1)                           │
│          │                                                      │
│ [折叠]   │                                                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 6.1.2 侧边栏规范

- **默认宽度**：240px
- **折叠宽度**：64px（仅图标）
- **可折叠**：通过切换按钮或 `[` 快捷键
- **持久化**：折叠状态存储在 localStorage

#### 6.1.3 顶栏规范

- **高度**：64px
- **左侧**：Logo + 系统名称
- **中间**：主导航菜单
- **右侧**：搜索、通知、用户菜单

### 6.2 Web 端应用（三栏布局）

#### 6.2.1 标准三栏布局

```
┌──────────┬────────────────────────────────────────────────┐
│          │  Breadcrumb bar                                │
│ Sidebar  ├──────────────────────────┬─────────────────────┤
│ (240px)  │  Main content            │  Properties panel   │
│          │  (flex-1)                │  (320px, optional)  │
│          │                          │                     │
└──────────┴──────────────────────────┴─────────────────────┘
```

#### 6.2.2 侧边栏详细设计

**公司头区**：
```
┌─────────────────────────┐
│ [icon] Acme Corp      ▼ │  ← 公司切换器下拉
├─────────────────────────┤
│ [🔍]  [✏️]              │  ← 搜索 + 新建任务
└─────────────────────────┘
```

**公司切换器**：
- 下拉按钮占据整个侧边栏头部宽度
- 显示：公司图标 + 公司名称（过长省略）+ 下拉箭头
- 点击展开显示：所有公司列表（带状态圆点：绿=活跃，黄=暂停，灰=归档）
- 下拉列表顶部：搜索框（多公司用户）
- 底部：分隔线 + "创建公司"按钮

**快捷按钮**：
- 🔍 搜索：打开 Cmd+K 搜索模态框
- ✏️ 新建任务：打开新建任务模态框

**个人区**（无标题头——始终在顶部，公司头区下方）：
```
  Inbox                    3
  My Issues
```

- **Inbox**：需要董事会操作员的注意项，右侧徽章计数
- **My Issues**：董事会操作员创建或分配给自己的任务

**工作区**（标题：**Work**，可折叠，带箭头切换）：
```
  Work                     ▼
    Issues
    Projects
    Goals
    Views
```

**公司区**（标题：**Company**，可折叠）：
```
  Company                  ▼
    Dashboard
    Org Chart
    Agents
    Costs
    Activity
```

#### 6.2.3 面包屑导航栏

```
┌─────────────────────────────────────────────────────────────────────┐
│ Projects › JiGongOpc › Issues › JGO-42  [⭐] [···]     [🔔] [⬜] │
└─────────────────────────────────────────────────────────────────────┘
```

**左侧**：
- 面包屑片段，用 `›` 分隔
- 每片可点击导航
- 当前片段：不可点击，稍粗文字
- ⭐ 收藏/固定当前实体
- ··· 更多操作（删除、归档、复制、复制链接等）

**右侧**：
- 🔔 通知铃铛（详情页订阅变更）
- ⬜ 面板切换（显示/隐藏右侧属性面板）

#### 6.2.4 详情页标签

某些详情页，面包屑栏下方有标签行：

**项目详情页**：
```
  Overview    Updates    Issues    Settings
```

**Agent 详情页**：
```
  Overview    Heartbeats    Issues    Costs
```

标签为胶囊形按钮，活动标签有背景填充。

### 6.3 移动端 H5（响应式布局）

#### 6.3.1 状态栏

- **高度**：62px（包含系统状态栏）
- **内容**：OS 控制（时间、信号、电池）

#### 6.3.2 内容区

- **单列垂直滚动**
- **左右边距**：16-20px
- **底部安全区**：21px（适配 Home Indicator）

#### 6.3.3 底部导航

- **高度**：62px
- **样式**：胶囊式 Tab Bar
- **圆角**：36px
- **Tab 数量**：3-5 个

#### 6.3.4 触摸规范

- **最小触摸目标**：44x44px
- **按钮高度**：48px
- **列表项高度**：56px

#### 6.3.5 响应式断点

| 断点 | 宽度 | 布局 | 侧边栏 |
|------|------|------|--------|
| Mobile S | 320px | 单列 | 隐藏（汉堡菜单） |
| Mobile M | 375px | 单列 | 隐藏（汉堡菜单） |
| Mobile L | 414px | 单列 | 隐藏（汉堡菜单） |
| Tablet | 768px | 双列 | 折叠（仅图标） |
| Desktop | 1024px+ | 多列 | 展开（240px） |

### 6.4 桌面端（Electron）

#### 6.4.1 窗口布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Title Bar (可拖拽)                                  [-][□][×] │
├─────────────────────────────────────────────────────────────────┤
│  Menu Bar (文件/编辑/视图/帮助)                                  │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ Sidebar  │                   Main Content                       │
│ (240px)  │                   (flex-1)                           │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

#### 6.4.2 窗口尺寸

| 尺寸类型 | 宽度 | 高度 | 说明 |
|----------|------|------|------|
| 最小窗口 | 1024px | 768px | 最小允许尺寸 |
| 默认窗口 | 1280px | 800px | 首次启动 |
| 推荐窗口 | 1920px | 1080px | 最佳体验 |

#### 6.4.3 窗口特性

- **可调整大小**：支持拖拽边缘调整
- **全屏支持**：支持 F11 全屏
- **多窗口**：支持打开多个窗口
- **系统托盘**：最小化到托盘
- **全局快捷键**：支持系统级快捷键

### 6.5 客户端（Uni-app / 鸿蒙）

#### 6.5.1 Android / iOS

```
┌─────────────────────────┐
│   Status Bar (44px)     │
├─────────────────────────┤
│   Navigation Bar (56px) │
├─────────────────────────┤
│                         │
│     Content Area        │
│     (flex-1)            │
│                         │
├─────────────────────────┤
│   Tab Bar (62px)        │
├─────────────────────────┤
│   Safe Area (21px)      │
└─────────────────────────┘
```

#### 6.5.2 鸿蒙 ArkTS

```
┌─────────────────────────┐
│   Status Bar (44px)     │
├─────────────────────────┤
│   Navigation Bar (56px) │
├─────────────────────────┤
│                         │
│     Content Area        │
│     (flex-1)            │
│                         │
├─────────────────────────┤
│   Tab Bar (62px)        │
└─────────────────────────┘
```

#### 6.5.3 客户端特性

- **下拉刷新**：列表页支持下拉刷新
- **上拉加载**：支持上拉加载更多
- **侧滑返回**：支持手势返回
- **深色模式**：跟随系统深色模式
- **横屏支持**：平板支持横屏

---

## 七、组件规范

### 7.1 表格组件

#### 7.1.1 列宽策略

| 列类型 | 宽度 | 说明 |
|--------|------|------|
| 主标识列 | 200-250px | 名称/标题 |
| 状态列 | 100-120px | 状态徽章 |
| 日期列 | 120-150px | 时间戳 |
| 操作列 | 80-100px | 操作按钮 |
| 内容列 | fill_container | 自适应填充 |

#### 7.1.2 分页

- **位置**：右下角
- **每页条数**：10/20/50 条可选
- **分页器**：标准分页器（上一页/页码/下一页）

### 7.2 表单组件

#### 7.2.1 对话框表单

- **表单宽度**：600px
- **字段排列**：垂直排列（单列）
- **标签位置**：顶部或左侧（100px）
- **按钮组**：右对齐

#### 7.2.2 抽屉表单

- **抽屉宽度**：480px
- **字段排列**：垂直排列
- **按钮组**：底部固定

### 7.3 卡片组件

- **内边距**：24px
- **圆角**：8px
- **阴影**：0 2px 8px rgba(0,0,0,0.1)
- **边框**：1px solid var(--bg-border)

### 7.4 按钮组件

#### 7.4.1 优先级

1. **Primary**：主操作（保存、提交）
2. **Secondary**：次级操作
3. **Outline**：取消、返回
4. **Ghost**：行内操作
5. **Destructive**：删除操作

#### 7.4.2 尺寸

| 尺寸 | 高度 | 字号 | 用途 |
|------|------|------|------|
| Small | 32px | 13px | 行内操作 |
| Medium | 40px | 14px | 默认尺寸 |
| Large | 48px | 16px | 主要 CTA |

### 7.5 状态徽章

```vue
<!-- StatusBadge 组件 -->
<template>
  <span class="status-badge" :class="`status-badge--${status}`">
    <span class="status-dot"></span>
    <span class="status-label">{{ label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--bg-surface);
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-color);
}
</style>
```

### 7.6 优先级图标

```vue
<!-- PriorityIcon 组件 -->
<template>
  <svg :class="`priority-${priority}`" width="16" height="16">
    <circle cx="8" cy="8" r="6"
            :fill="fillColor"
            :stroke="strokeColor"
            stroke-width="2"/>
  </svg>
</template>

<script setup>
const priorityMap = {
  critical: { fill: '#ff4444', stroke: '#ff4444' },
  high: { fill: 'url(#gradient-high)', stroke: '#ff8800' },
  medium: { fill: 'transparent', stroke: '#e6c84a' },
  low: { fill: 'transparent', stroke: '#656f7a', strokeDasharray: '2,2' }
};
</script>
```

---

## 八、任务管理 UI

### 8.1 任务列表视图

```
┌─────────────────────────────────────────────────────────────────┐
│ [All Issues] [Active] [Backlog]  [⚙ Settings]    [≡ Filter]  [Display ▼] │
├─────────────────────────────────────────────────────────────────┤
│ ▼ Todo                                                3    [+] │
│ ☐ --- CLIP-5  ○ Implement user auth          @CTO    Feb 16  │
│ ☐ --- CLIP-3  ○ Set up CI pipeline           @DevOps Feb 16  │
│ ☐ --- CLIP-8  ○ Write API documentation      @Writer Feb 17  │
│                                                                 │
│ ▼ In Progress                                         2    [+] │
│ ☐ !!! CLIP-1  ◐ Build landing page           @FE     Feb 15  │
│ ☐ --- CLIP-4  ◐ Database schema design       @CTO    Feb 14  │
│                                                                 │
│ ▼ Backlog                                             5    [+] │
│ ☐ --- CLIP-9  ◌ Research competitors                  Feb 17  │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

**顶部工具栏**：
- **状态标签**：All Issues、Active、Backlog，带状态图标和计数
- **设置齿轮**：配置任务显示默认值、自定义字段
- **筛选按钮**：打开筛选栏
- **显示下拉**：切换分组模式（按状态/优先级/分配者/项目）和布局模式（列表/看板）

**分组**：
- 默认按状态分组
- 每组头部：折叠箭头、状态图标、状态名、计数、+ 新建按钮
- 组可折叠

**任务行**（左到右）：
1. **复选框**：默认隐藏，悬停显示（优先级左侧）
2. **优先级指示器**：始终显示
3. **任务键**：如 `CLIP-5`，等宽字体，柔和色
4. **状态圆**：可点击打开状态下拉
5. **标题**：主文字，过长省略
6. **分配者**：头像 + 名称，右对齐，未分配显示虚线圆圈
7. **日期**：创建日期或目标日期，柔和色，最右

### 8.2 任务筛选栏

```
┌─────────────────────────────────────────────────────────┐
│ [+ Add filter]  Status is Todo, In Progress  [×]        │
│                 Priority is Critical, High    [×]        │
│                 Assignee is CTO-Agent         [×]        │
└─────────────────────────────────────────────────────────┘
```

- 每个筛选为芯片，显示 `字段 操作符 值`
- 点击芯片编辑
- `×` 移除筛选
- `+ Add filter` 打开字段下拉：Status、Priority、Assignee、Project、Goal、创建日期、Labels、创建者
- 筛选为 AND 组合
- 持久化到 URL query string（可分享/可收藏）

### 8.3 任务详情页（三栏）

```
┌──────────┬────────────────────────────────┬──────────────────────┐
│          │ Issues › CLIP-42               │                      │
│ Sidebar  │                                │   Properties     [+] │
│          │ Fix user authentication bug    │                      │
│          │ Implement proper token...      │   Status    In Progress │
│          │                                │   Priority  High     │
│          │ ┌──────────────────────────┐   │   Assignee  CTO      │
│          │ │ Properties bar (inline)  │   │   Project   Auth     │
│          │ │ In Progress · High ·     │   │   Goal      Security │
│          │ │ CTO · Auth project · ... │   │   Labels    bug, auth│
│          │ └──────────────────────────┘   │   Start     Feb 15   │
│          │                                │   Target    Feb 20   │
│          │ Description                    │   Created   Feb 14   │
│          │ ─────────────────              │                      │
│          │ The current authentication     │   ─────────────────  │
│          │ system has a token refresh...  │   Activity           │
│          │                                │   CTO commented 2h   │
│          │ Comments                       │   Status → In Prog   │
│          │ ─────────────────              │   Created by Board   │
│          │ [avatar] CTO · 2 hours ago     │                      │
│          │ I've identified the root...    │                      │
│          │                                │                      │
│          │ [avatar] DevOps · 1 hour ago   │                      │
│          │ The CI is set up to run...     │                      │
│          │                                │                      │
│          │ ┌──────────────────────────┐   │                      │
│          │ │ Write a comment...       │   │                      │
│          │ └──────────────────────────┘   │                      │
└──────────┴────────────────────────────────┴──────────────────────┘
```

**中间栏（主内容）**：
- **头部**：任务标题（18px，半粗体），可点击编辑
- **副标题**：任务键 `CLIP-42`，柔和色
- **属性栏**：内联属性芯片 `[○ In Progress] [!!! High] [👤 CTO] [📅 Target date] [📁 Auth] [···]`
- **描述**：Markdown 渲染，点击编辑
- **子任务**：可折叠区块，每个子任务为迷你任务行
- **评论**：chronological 列表，头像 + 作者 + 时间戳 + Markdown 正文

**右侧栏（属性面板）**：
- 头部：Properties 标签 + 添加自定义字段按钮
- 属性列表：标签左，可编辑值右

| 属性 | 控件 |
|------|------|
| Status | 带彩色点的下拉 |
| Priority | 带图标的下拉 |
| Assignee | 可搜索的 Agent 选择器 |
| Project | 项目选择器 |
| Goal | 目标选择器 |
| Labels | 多选标签输入 |
| Lead | Agent 选择器 |
| Members | 多选 Agent 选择器 |
| Start date | 日期选择器 |
| Target date | 日期选择器 |
| Created by | 只读文字 |
| Created | 只读时间戳 |
| Billing code | 文本输入 |

### 8.4 新建任务模态框

```
┌─────────────────────────────────────────────────────────┐
│ [📁 CLIP] › New issue               [Save as draft] [↗] [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Issue title                                             │
│ ___________________________________________________     │
│                                                         │
│ Add a description...                                    │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [○ Todo] [--- Priority] [👤 Assignee] [📁 Project]     │
│ [🏷 Labels] [···]                                       │
├─────────────────────────────────────────────────────────┤
│ [📎]                    [◻ Create more] [Create issue]  │
└─────────────────────────────────────────────────────────┘
```

**顶部栏**：
- 面包屑：项目键 `›` "New issue"
- "Save as draft" 按钮
- 展开图标（打开为全页）
- 关闭 ×

**主体**：
- 标题字段：大输入框，占位符"Issue title"，自动聚焦
- 描述：Markdown 编辑器，占位符"Add a description..."，可展开

**属性芯片（底部栏）**：
- 紧凑属性按钮行
- 默认芯片：Status（默认 Todo）、Priority、Assignee、Project、Labels
- `···` 更多按钮：Goal、Start date、Target date、Billing code、Parent issue

**底部**：
- 附件按钮（回形针图标）
- "Create more" 切换：开启时创建任务后清空表单继续快速录入
- "Create issue" 主按钮

**行为**：
- `Cmd+Enter` 提交表单
- 从项目上下文中打开，项目预填充
- 从状态组 + 按钮打开，状态预填充
- 任务键自动生成：项目前缀 + 递增数字

### 8.5 任务看板视图

通过 Display 下拉 → Board 布局访问。

列表示状态：Backlog | Todo | In Progress | In Review | Done

每卡片显示：
- 任务键（柔和色）
- 标题（主文字）
- 优先级图标（左下）
- 分配者头像（右下）

卡片可在列间拖拽，拖拽到新列改变状态（无效转换显示错误 Toast）。

每列头部有 + 按钮新建该状态任务。

---

## 九、Inbox（收件箱）

Inbox 是董事会操作员的主要行动中心，聚合所有需要人工注意的事项，审批为最高优先级类别。

### 9.1 Inbox 列表视图

```
┌─────────────────────────────────────────────────────────┐
│ Inbox                               [Mark all read]     │
├─────────────────────────────────────────────────────────┤
│ APPROVALS                        See all approvals →    │
│ ● 🛡 Hire Agent: "Marketing Analyst"                    │
│ │  Requested by CEO · 2h ago                            │
│ │  Role: marketing · Reports to: CMO · Budget: $100/mo  │
│ │  [✕ Reject]  [✓ Approve]                              │
│ │                                                       │
│ ● 🛡 CEO Strategy: "Q2 Growth Plan"                     │
│ │  Requested by CEO · 4h ago                            │
│ │  [View details →]                                     │
│                                                         │
│ ALERTS                                                  │
│ ● 🔴 Agent Error: DevOps heartbeat failed       1h ago  │
│ ● ⚠  Budget Alert: CEO at 80% monthly budget   3h ago  │
│                                                         │
│ STALE WORK                                              │
│   ⏰ CLIP-3 "Set up CI pipeline" — no update in 24h     │
│   ⏰ CLIP-7 "Write tests" — no update in 36h            │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Inbox 分类

按类别分组，最可操作的项在前：

**待审批**（最高优先级）：
- 每个审批项显示：盾牌图标 + 审批类型 + 标题
- 请求者 + 相对时间戳
- 关键负载摘要（1 行）
- 内联 **[Approve]** 和 **[Reject]** 按钮（简单审批）
- **[View details →]** 链接（复杂审批需完整审查）
- "See all approvals →" 链接到 /approvals

**警报**：
- Agent 错误（心跳失败、错误状态）
- 预算警报（Agent/公司接近 80% 或 100% 限制）
- 链接到相关 Agent 或成本页面

**停滞工作**：
- `in_progress` 或 `todo` 状态，超过阈值（默认 24h）无活动
- 显示任务键、标题、最后活动时间
- 点击导航到任务

---

## 十、Dashboard

Dashboard 是公司健康总览。

### 10.1 布局

```
┌──────────┬──────────────────────────────────────────────┐
│          │ Dashboard                                     │
│ Sidebar  │                                               │
│          │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────┐│
│          │ │ Agents   │ │ Tasks   │ │ Costs   │ │Apprvl││
│          │ │ 12 total │ │ 47 open │ │ $234.50 │ │ 3    ││
│          │ │ 8 active │ │ 12 prog │ │ 67% bud │ │pending│
│          │ │ 2 paused │ │ 3 block │ │         │ │      ││
│          │ │ 1 error  │ │ 28 done │ │         │ │      ││
│          │ └─────────┘ └─────────┘ └─────────┘ └──────┘│
│          │                                               │
│          │ ┌────────────────────┐ ┌─────────────────────┐│
│          │ │ Recent Activity    │ │ Stale Tasks          ││
│          │ │ ...                │ │ ...                   ││
│          │ └────────────────────┘ └─────────────────────┘│
└──────────┴──────────────────────────────────────────────┘
```

**第一行：指标卡片**（4 个一排）
1. **Agents** — 总数、活跃、运行、暂停、错误计数，带彩色点
2. **Tasks** — 打开、进行中、阻塞、完成计数
3. **Costs** — 月至今花费（美元）、预算使用率百分比 + 迷你进度条
4. **Approvals** — 待审批计数（可点击导航到 Inbox）

**第二行：详情面板**（2 个一排）
5. **Recent Activity** — 最近 ~10 条活动日志条目
6. **Stale Tasks** — 长时间无更新的任务

所有卡片和面板可点击导航到对应完整页面。

---

## 十一、组织架构图

### 11.1 树形视图

```
                    ┌─────────┐
                    │ CEO     │
                    │ running │
                    └────┬────┘
            ┌────────────┼────────────┐
       ┌────┴────┐  ┌────┴────┐  ┌───┴─────┐
       │ CTO     │  │ CMO     │  │ CFO     │
       │ active  │  │ idle    │  │ paused  │
       └────┬────┘  └────┬────┘  └─────────┘
       ┌────┴────┐  ┌────┴────┐
       │ Dev-1   │  │ Mktg-1  │
       │ running │  │ idle    │
       └─────────┘  └─────────┘
```

每节点显示：
- Agent 名称
- 角色/头衔（小字）
- 状态圆点（彩色表示状态）
- Agent 头像（机器人图标 + 唯一颜色）

### 11.2 交互

- 鼠标滚轮/拖拽缩放平移
- 点击节点选中，显示关键信息工具提示
- 双击节点导航到 Agent 详情
- 右键节点上下文菜单：View、Pause、Resume、Invoke heartbeat、Edit

---

## 十二、键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Cmd+K` | 打开搜索 |
| `C` | 新建任务 |
| `Cmd+Enter` | 提交表单（模态框中） |
| `Escape` | 关闭模态框/取消选中 |
| `[` | 切换侧边栏折叠 |
| `]` | 切换属性面板 |
| `J` / `K` | 列表中上/下导航 |
| `Enter` | 打开选中项 |
| `Backspace` | 返回 |
| `S` | 切换选中任务状态 |
| `X` | 切换复选框选中 |
| `Cmd+A` | 全选（列表上下文中） |

---

## 十三、空状态

每个列表视图应有精心设计的空状态：

| 空状态 | 文案 | CTA |
|--------|------|-----|
| 无任务 | "No issues yet. Create your first issue to start tracking work." | [Create issue] |
| 无 Agent | "No agents in this company. Create an agent to start building your team." | [Create agent] |
| 无公司选择 | "Select a company to get started." | [Create company] |

空状态应有柔和插图（简洁线条艺术，非卡通）和单一 CTA。

---

## 十四、加载和错误状态

| 状态 | 表现 |
|------|------|
| **加载** | 骨架屏占位符（非转圈），匹配预期内容布局，微妙闪光动画 |
| **错误** | 内联错误消息 + 重试按钮，非全页错误（除非应用本身故障） |
| **冲突 (409)** | Toast 通知："This issue was updated by another user. Refresh to see changes." + [Refresh] |
| **乐观更新** | 状态改变和属性编辑立即更新 UI，失败时回滚 |

---

## 十五、组件库

基于 Element Plus 组件，自定义如下：

| 组件 | 基础 | 自定义 |
|------|------|--------|
| StatusBadge | Badge | 彩色点 + 标签，实体特定色板 |
| PriorityIcon | custom | SVG 圆圈填充匹配优先级 |
| EntityRow | custom | 标准化列表行，悬停/选中状态 |
| PropertyEditor | custom | 标签 + 内联可编辑值 + 下拉 |
| CommentThread | custom | 头像 + 作者 + 时间戳 + Markdown 正文 |
| BreadcrumbBar | Breadcrumb | 集成路由、标签、实体操作 |
| CommandPalette | Dialog | Cmd+K 搜索，即时输入，带操作 |
| FilterBar | custom | 可组合筛选芯片，添加/移除 |
| SidebarNav | custom | 分组、可折叠、支持徽章的导航 |

---

## 十六、Pencil 设计图规范

### 16.1 设计图 ID 命名

格式：`[模块]-[页面类型]-[序号]`

示例：
- `company-list-001`：公司列表页
- `company-form-001`：公司创建表单
- `company-detail-001`：公司详情页
- `agent-list-001`：Agent 列表页
- `agent-orgchart-001`：Agent 组织架构图
- `task-list-001`：任务列表页
- `task-detail-001`：任务详情页
- `inbox-001`：Inbox 页面
- `dashboard-001`：Dashboard 页面

### 16.2 设计图管理

- **文件位置**：`specs/assets/designs/*.pen`
- **版本控制**：Git 管理
- **设计系统**：统一组件库

### 16.3 设计图与代码关联

| 设计图 ID | 前端路由 | 前端组件 | API |
|----------|---------|---------|-----|
| company-list-001 | /company | company-list.vue | GET /api/company/list |
| company-form-001 | /company/new | company-form.vue | POST /api/company |
| company-detail-001 | /company/:id | company-detail.vue | GET /api/company/:id |
| agent-list-001 | /agent | agent-list.vue | GET /api/agent/list |
| agent-detail-001 | /agent/:id | agent-detail.vue | GET /api/agent/:id |
| task-list-001 | /issue | task-list.vue | GET /api/issue/list |
| task-detail-001 | /issue/:id | task-detail.vue | GET /api/issue/:id |

---

## 十七、国际化规范

### 17.1 支持语言

系统必须支持以下语言（按需扩展）：

| 语言代码 | 语言名称 | 说明 |
|----------|----------|------|
| zh-CN | 简体中文 | 默认语言 |
| en-US | 英文（美国） | 国际通用 |
| ja-JP | 日文 | 日本用户 |
| ko-KR | 韩文 | 韩国用户 |
| zh-TW | 繁体中文 | 港澳台用户 |
| de-DE | 德文 | 欧洲用户 |
| fr-FR | 法文 | 欧洲用户 |
| es-ES | 西班牙文 | 欧洲/拉美用户 |

### 17.2 核心原则

- **零硬编码** - 所有文案必须通过国际化系统获取，禁止在代码中写死任何用户可见文案
- **原表结构不变** - 不破坏原有业务代码
- **翻译表模式** - 为每个需要多语言的表创建 `_translation` 表
- **语言代码** - 小写，如 `zh-CN`, `en-US`, `ja-JP`, `ko-KR`
- **前端使用** - `t('common.button.save')` 调用翻译
- **后端使用** - `messageSource.getMessage("common.button.save", null, locale)`
- **默认语言** - zh-CN（简体中文）
- **语言切换** - 用户可随时切换语言，无需重新登录

### 17.3 前端国际化实现

#### 17.3.1 i18n 配置文件结构

```
src/locales/
├── zh-CN/
│   ├── jigongopc/
│   │   ├── common.json          # 通用文案
│   │   ├── company.json         # 公司模块
│   │   ├── agent.json           # Agent 模块
│   │   ├── task.json            # 任务模块
│   │   ├── project.json         # 项目模块
│   │   ├── goal.json            # 目标模块
│   │   ├── approval.json        # 审批模块
│   │   ├── cost.json            # 成本模块
│   │   ├── inbox.json           # Inbox 模块
│   │   ├── dashboard.json       # Dashboard 模块
│   │   ├── activity.json        # 活动日志模块
│   │   └── settings.json        # 设置模块
│   ├── element-plus.json        # Element Plus 组件翻译
│   └── index.js                 # 语言包入口
├── en-US/
│   └── jigongopc/
│       ├── common.json
│       ├── company.json
│       └── ...
├── ja-JP/
└── ko-KR/
```

#### 17.3.2 common.json 示例

```json
{
  "title": "JiGongOpc",
  "loading": "加载中...",
  "search": "搜索",
  "searchPlaceholder": "请输入关键字...",
  "create": "创建",
  "edit": "编辑",
  "delete": "删除",
  "save": "保存",
  "cancel": "取消",
  "confirm": "确认",
  "submit": "提交",
  "back": "返回",
  "refresh": "刷新",
  "actions": "操作",
  "status": "状态",
  "description": "描述",
  "createTime": "创建时间",
  "updateTime": "更新时间",
  "createdBy": "创建人",
  "updatedBy": "更新人",
  "noData": "暂无数据",
  "loadFailed": "加载失败",
  "saveSuccess": "保存成功",
  "saveFailed": "保存失败",
  "deleteSuccess": "删除成功",
  "deleteFailed": "删除失败",
  "deleteConfirm": "确定要删除{type}「{name}」吗？",
  "confirmTitle": "确认操作",
  "view": "查看",
  "detail": "详情",
  "settings": "设置",
  "profile": "个人资料",
  "logout": "退出登录",
  "language": "语言",
  "theme": "主题",
  "darkMode": "深色模式",
  "lightMode": "浅色模式",
  "pagination": {
    "total": "共 {total} 条",
    "page": "第 {current} 页",
    "pageSize": "每页 {size} 条",
    "goto": "跳至",
    "pageLabel": "页"
  },
  "status": {
    "active": "活跃",
    "paused": "暂停",
    "archived": "归档",
    "pending": "待处理",
    "approved": "已批准",
    "rejected": "已拒绝",
    "cancelled": "已取消"
  },
  "priority": {
    "critical": "紧急",
    "high": "高",
    "medium": "中",
    "low": "低"
  }
}
```

#### 17.3.3 company.json 示例

```json
{
  "title": "公司管理",
  "create": "创建公司",
  "edit": "编辑公司",
  "delete": "删除公司",
  "deleteConfirm": "确定要删除公司「{name}」吗？",
  "searchPlaceholder": "搜索公司名称...",
  "fields": {
    "name": "公司名称",
    "description": "公司描述",
    "status": "状态",
    "issuePrefix": "问题前缀",
    "budgetMonthlyCents": "月度预算",
    "spentMonthlyCents": "月度支出",
    "createTime": "创建时间",
    "updateTime": "更新时间"
  },
  "status": {
    "active": "活跃",
    "paused": "暂停",
    "archived": "归档"
  },
  "form": {
    "nameRequired": "请输入公司名称",
    "nameLength": "公司名称长度必须在 2-100 之间",
    "issuePrefixRequired": "请输入问题前缀",
    "issuePrefixPattern": "问题前缀必须为 2-10 位大写字母",
    "saveSuccess": "保存成功",
    "saveFailed": "保存失败"
  },
  "placeholder": {
    "name": "请输入公司名称",
    "description": "请输入公司描述",
    "issuePrefix": "如：DEMO"
  }
}
```

#### 17.3.4 Element Plus 组件翻译

```javascript
// src/locales/zh-CN/element-plus.json
export default {
  el: {
    pagination: {
      goto: '跳至',
      pagesize: '条/页',
      total: '共 {total} 条',
      pageClassifier: '页',
    },
    messagebox: {
      title: '提示',
      confirm: '确定',
      cancel: '取消',
    },
    table: {
      emptyText: '暂无数据',
      confirmFilter: '筛选',
      resetFilter: '重置',
      clearAll: '清空',
    },
    select: {
      noMatch: '无匹配数据',
      noData: '无数据',
      placeholder: '请选择',
    },
    cascader: {
      noMatch: '无匹配数据',
      placeholder: '请选择',
    },
    tree: {
      emptyText: '暂无数据',
    },
    datepicker: {
      now: '此刻',
      today: '今天',
      cancel: '取消',
      clear: '清空',
      confirm: '确定',
      selectDate: '选择日期',
      selectTime: '选择时间',
      startDate: '开始日期',
      startTime: '开始时间',
      endDate: '结束日期',
      endTime: '结束时间',
      prevYear: '前一年',
      nextYear: '后一年',
      prevMonth: '上个月',
      nextMonth: '下个月',
      year: '年',
      month1: '1 月',
      month2: '2 月',
      // ... 其他月份
    },
    // ... 其他组件翻译
  },
};
```

#### 17.3.5 i18n 配置

```javascript
// src/locales/index.js
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';
import jaJP from './ja-JP';
import koKR from './ko-KR';

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
};

const i18n = createI18n({
  legacy: false,  // 使用 Composition API
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages,
  globalInjection: true,
});

export default i18n;
```

#### 17.3.6 语言切换组件

```vue
<!-- src/components/LanguageSwitcher.vue -->
<template>
  <el-dropdown @command="handleLanguageChange">
    <span class="language-trigger">
      <el-icon><Globe /></el-icon>
      {{ currentLanguage.label }}
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="lang in languages"
          :key="lang.code"
          :command="lang.code"
        >
          {{ lang.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Globe } from '@element-plus/icons-vue';

const { locale, t } = useI18n();

const languages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-TW', label: '繁體中文' },
];

const currentLanguage = computed(() => {
  return languages.find(lang => lang.code === locale.value) || languages[0];
});

const handleLanguageChange = (langCode) => {
  locale.value = langCode;
  localStorage.setItem('locale', langCode);
  // 触发语言切换事件
  window.dispatchEvent(new CustomEvent('language-change', { detail: langCode }));
};
</script>
```

#### 17.3.7 组件使用示例

```vue
<template>
  <div class="company-list">
    <!-- 页头 -->
    <div class="page-header">
      <h2 class="page-title">{{ t('company.title') }}</h2>
      <el-button type="primary" @click="handleCreate">
        {{ t('company.create') }}
      </el-button>
    </div>

    <!-- 表格 -->
    <el-table :data="companyList">
      <el-table-column prop="name" :label="t('company.fields.name')" />
      <el-table-column prop="status" :label="t('company.fields.status')">
        <template #default="{ row }">
          {{ t(`company.status.${row.status}`) }}
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')">
        <template #default="{ row }">
          <el-button link type="primary">{{ t('common.view') }}</el-button>
          <el-button link type="primary">{{ t('common.edit') }}</el-button>
          <el-button link type="danger">{{ t('common.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      :total="total"
      :page-sizes="[10, 20, 50]"
      :page-texts="[
        t('pagination.total'),
        t('pagination.page'),
        t('pagination.pageSize')
      ]"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
```

### 17.4 后端国际化实现

#### 17.4.1 配置文件结构

```
src/main/resources/
├── i18n/
│   ├── messages.properties           # 默认（英文）
│   ├── messages_zh_CN.properties     # 简体中文
│   ├── messages_en_US.properties     # 英文
│   ├── messages_ja_JP.properties     # 日文
│   ├── messages_ko_KR.properties     # 韩文
│   └── messages_zh_TW.properties     # 繁体中文
```

#### 17.4.2 messages_zh_CN.properties 示例

```properties
# 通用
common.title=JiGongOpc
common.loading=加载中...
common.search=搜索
common.searchPlaceholder=请输入关键字...
common.create=创建
common.edit=编辑
common.delete=删除
common.save=保存
common.cancel=取消
common.confirm=确认
common.submit=提交
common.back=返回
common.refresh=刷新
common.actions=操作
common.status=状态
common.description=描述
common.createTime=创建时间
common.updateTime=更新时间
common.createdBy=创建人
common.updatedBy=更新人
common.noData=暂无数据
common.loadFailed=加载失败
common.saveSuccess=保存成功
common.saveFailed=保存失败
common.deleteSuccess=删除成功
common.deleteFailed=删除失败
common.deleteConfirm=确定要删除{0}「{1}」吗？
common.confirmTitle=确认操作
common.view=查看
common.detail=详情
common.settings=设置
common.profile=个人资料
common.logout=退出登录
common.language=语言

# 状态
common.status.active=活跃
common.status.paused=暂停
common.status.archived=归档
common.status.pending=待处理
common.status.approved=已批准
common.status.rejected=已拒绝
common.status.cancelled=已取消

# 优先级
common.priority.critical=紧急
common.priority.high=高
common.priority.medium=中
common.priority.low=低

# 公司模块
company.title=公司管理
company.create=创建公司
company.edit=编辑公司
company.delete=删除公司
company.deleteConfirm=确定要删除公司「{0}」吗？
company.searchPlaceholder=搜索公司名称...
company.fields.name=公司名称
company.fields.description=公司描述
company.fields.status=状态
company.fields.issuePrefix=问题前缀
company.fields.budgetMonthlyCents=月度预算
company.fields.spentMonthlyCents=月度支出
company.fields.createTime=创建时间
company.fields.updateTime=更新时间
company.status.active=活跃
company.status.paused=暂停
company.status.archived=归档
company.form.nameRequired=请输入公司名称
company.form.nameLength=公司名称长度必须在 2-100 之间
company.form.issuePrefixRequired=请输入问题前缀
company.form.issuePrefixPattern=问题前缀必须为 2-10 位大写字母
company.form.saveSuccess=保存成功
company.form.saveFailed=保存失败
```

#### 17.4.3 messages_en_US.properties 示例

```properties
# Common
common.title=JiGongOpc
common.loading=Loading...
common.search=Search
common.searchPlaceholder=Enter keywords...
common.create=Create
common.edit=Edit
common.delete=Delete
common.save=Save
common.cancel=Cancel
common.confirm=Confirm
common.submit=Submit
common.back=Back
common.refresh=Refresh
common.actions=Actions
common.status=Status
common.description=Description
common.createTime=Create Time
common.updateTime=Update Time
common.createdBy=Created By
common.updatedBy=Updated By
common.noData=No Data
common.loadFailed=Load Failed
common.saveSuccess=Save Successful
common.saveFailed=Save Failed
common.deleteSuccess=Delete Successful
common.deleteFailed=Delete Failed
common.deleteConfirm=Are you sure to delete {0} "{1}"?
common.confirmTitle=Confirm
common.view=View
common.detail=Detail
common.settings=Settings
common.profile=Profile
common.logout=Logout
common.language=Language

# Status
common.status.active=Active
common.status.paused=Paused
common.status.archived=Archived
common.status.pending=Pending
common.status.approved=Approved
common.status.rejected=Rejected
common.status.cancelled=Cancelled

# Priority
common.priority.critical=Critical
common.priority.high=High
common.priority.medium=Medium
common.priority.low=Low

# Company
company.title=Company Management
company.create=Create Company
company.edit=Edit Company
company.delete=Delete Company
company.deleteConfirm=Are you sure to delete company "{0}"?
company.searchPlaceholder=Search company name...
company.fields.name=Company Name
company.fields.description=Description
company.fields.status=Status
company.fields.issuePrefix=Issue Prefix
company.fields.budgetMonthlyCents=Monthly Budget
company.fields.spentMonthlyCents=Monthly Spent
company.fields.createTime=Create Time
company.fields.updateTime=Update Time
company.status.active=Active
company.status.paused=Paused
company.status.archived=Archived
company.form.nameRequired=Please enter company name
company.form.nameLength=Company name length must be between 2-100
company.form.issuePrefixRequired=Please enter issue prefix
company.form.issuePrefixPattern=Issue prefix must be 2-10 uppercase letters
company.form.saveSuccess=Save successful
company.form.saveFailed=Save failed
```

#### 17.4.4 国际化配置类

```java
// src/main/java/org/springblade/jigongopc/common/config/I18nConfig.java
@Configuration
public class I18nConfig {

    /**
     * 国际化消息源
     */
    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasenames("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        source.setCacheSeconds(3600);
        source.setFallbackToSystemLocale(false);
        return source;
    }

    /**
     * 区域解析器 - 从 Header 中获取语言
     */
    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.SIMPLIFIED_CHINESE);
        return resolver;
    }
}
```

#### 17.4.5 国际化拦截器

```java
// src/main/java/org/springblade/jigongopc/common/interceptor/LanguageInterceptor.java
@Component
public class LanguageInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                            Object handler) throws Exception {
        // 从请求头获取语言参数
        String lang = request.getHeader("Accept-Language");
        if (StringUtils.hasText(lang)) {
            // 设置到请求上下文中
            LocaleContext localeContext = new LocaleContext(parseLocale(lang));
            LocaleContextHolder.setLocaleContext(localeContext, true);
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                               Object handler, Exception ex) throws Exception {
        LocaleContextHolder.resetLocaleContext();
    }

    private Locale parseLocale(String langHeader) {
        // 解析类似 "zh-CN,zh;q=0.9,en;q=0.8" 的头部
        if (langHeader.contains(",")) {
            langHeader = langHeader.split(",")[0];
        }
        String[] parts = langHeader.split("-");
        if (parts.length == 2) {
            return new Locale(parts[0], parts[1]);
        }
        return new Locale(langHeader);
    }
}
```

#### 17.4.6 工具类

```java
// src/main/java/org/springblade/jigongopc/common/util/I18nUtil.java
@Component
public class I18nUtil implements ApplicationContextAware {

    private static ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext context) throws BeansException {
        applicationContext = context;
    }

    /**
     * 获取国际化消息
     * @param code 消息码
     * @return 翻译后的消息
     */
    public static String getMessage(String code) {
        return getMessage(code, new Object[]{});
    }

    /**
     * 获取国际化消息（带参数）
     * @param code 消息码
     * @param args 参数
     * @return 翻译后的消息
     */
    public static String getMessage(String code, Object... args) {
        MessageSource messageSource = applicationContext.getBean(MessageSource.class);
        Locale locale = LocaleContextHolder.getLocale();
        return messageSource.getMessage(code, args, locale);
    }

    /**
     * 获取国际化消息（指定语言）
     * @param code 消息码
     * @param locale 语言环境
     * @param args 参数
     * @return 翻译后的消息
     */
    public static String getMessage(String code, Locale locale, Object... args) {
        MessageSource messageSource = applicationContext.getBean(MessageSource.class);
        return messageSource.getMessage(code, args, locale);
    }
}
```

#### 17.4.7 统一响应国际化

```java
// src/main/java/org/springblade/jigongopc/common/response/R.java
@Data
public class R<T> implements Serializable {

    private Integer code;
    private boolean success;
    private T data;
    private String message;

    public static <T> R<T> success(T data) {
        R<T> r = new R<>();
        r.setCode(200);
        r.setSuccess(true);
        r.setData(data);
        r.setMessage(I18nUtil.getMessage("common.saveSuccess"));
        return r;
    }

    public static <T> R<T> fail(String message) {
        R<T> r = new R<>();
        r.setCode(500);
        r.setSuccess(false);
        r.setMessage(message);
        return r;
    }

    public static <T> R<T> fail(String code, Object... args) {
        R<T> r = new R<>();
        r.setCode(500);
        r.setSuccess(false);
        r.setMessage(I18nUtil.getMessage(code, args));
        return r;
    }
}
```

### 17.5 业务数据翻译表

详见 [SPEC-102-UI-UX 设计规范.md](./SPEC-102-UI-UX 设计规范.md) 第 5 节。

### 17.6 翻译管理规范

#### 17.6.1 翻译文件命名

| 文件类型 | 命名规范 | 示例 |
|----------|----------|------|
| 前端语言包 | `{langCode}.json` | `zh-CN.json`, `en-US.json` |
| 后端属性文件 | `messages_{langCode}.properties` | `messages_zh_CN.properties` |
| 数据库翻译表 | `{原表名}_translation` | `t_company_translation` |

#### 17.6.2 翻译键命名

```
模块。子模块。用途
例如:
- company.form.nameRequired
- task.status.pending
- common.button.save
```

#### 17.6.3 翻译质量检测

- 所有翻译文件必须完整（所有语言包含相同的键）
- 翻译值不能为空或与键相同
- 参数占位符必须匹配（`{0}`, `{1}` 等）
- 定期使用工具检测缺失的翻译

### 17.7 语言切换流程

```
用户点击语言切换器
  ↓
前端更新 localStorage.locale
  ↓
前端设置 i18n.locale
  ↓
前端发送语言切换事件
  ↓
所有组件重新渲染（使用新语言）
  ↓
后续 API 请求头携带 Accept-Language
  ↓
后端从 Header 解析语言
  ↓
返回对应语言的错误消息
```

---

## 十八、时区规范

详见 [SPEC-109 时区管理规范](./SPEC-109-时区管理规范.md)。

核心原则：
- **数据库存储**：UTC 时间（TIMESTAMPTZ）
- **API 返回**：ISO 8601 格式（2026-03-14T10:00:00Z）
- **前端展示**：dayjs + timezone 插件，UTC 存储，本地展示
- **用户时区**：从用户配置读取，支持全球主要时区

---

## 十九、URL 结构

所有路由在公司选择后限定公司范围（公司上下文存储在 React context，非 URL）：

```
/                           → 重定向到 /dashboard
/dashboard                  → 公司 Dashboard
/inbox                      → Inbox / 注意项
/my-issues                  → 董事会操作员的任务
/issues                     → 任务列表
/issues/:issueId            → 任务详情
/projects                   → 项目列表
/projects/:projectId        → 项目详情（Overview 标签）
/projects/:projectId/issues → 项目任务
/goals                      → 目标层级
/goals/:goalId              → 目标详情
/org                        → 组织架构图
/agents                     → Agent 列表
/agents/:agentId            → Agent 详情
/approvals                  → 审批列表
/approvals/:approvalId      → 审批详情
/costs                      → 成本仪表板
/activity                   → 活动日志
/companies                  → 公司管理（列表/创建）
/settings                   → 公司设置
```

---

## 二十、实现优先级

### Phase 1：外壳和导航
1. 侧边栏重新设计（分组区块、图标、公司切换器、徽章）
2. 面包屑栏组件
3. 三栏布局系统
4. Cmd+K 搜索模态框
5. 安装 `lucide-vue-next`

### Phase 2：任务管理（核心）
6. 任务列表视图（分组、筛选、状态圆）
7. 任务详情页（三栏 + 属性面板）
8. 新建任务模态框
9. 任务评论
10. 批量选择和操作
11. 看板视图

### Phase 3：实体详情页
12. 项目列表 + 详情页
13. 目标层级视图
14. Agent 列表 + 详情页

### Phase 4：公司级视图
15. Inbox（内联审批操作，主要审批 UX）
16. Dashboard 重新设计（指标卡片）
17. 组织架构图交互可视化
18. 成本仪表板
19. 活动日志（带筛选）
20. 审批列表页（通过 Inbox "See all" 访问，非侧边栏）

### Phase 5：打磨
21. 键盘快捷键
22. 响应式行为
23. 空状态和加载骨架屏
24. 错误处理和 Toast
25. 保存视图（自定义筛选）

---

## 二十一、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
| v2.0 | 2026-03-14 | AI Assistant | 合并 SPEC-102 和 SPEC-110，扩展各端设计规范 |
