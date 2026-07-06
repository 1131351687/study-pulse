# StudyPulse 使用教程

## 目录

1. 项目简介
2. 环境准备
3. 一键启动
4. 手动启动
5. 界面功能说明
6. 配置 AI 提供商
7. MCP Server 接入外部 AI
8. 常见问题

---

## 项目简介

StudyPulse 是一个本地优先的学习工作台。它把以下几个数据源整合到一起：

- ActivityWatch：自动记录你在电脑上使用各应用和窗口的时长。
- 学习日志：你手动写下的每日学习笔记。
- 任务清单：今日待办事项，可手动添加或从 AI 规划中接受。
- 日程块：按日期和时间安排的学习时间块。
- 学习目标：你定义的长期学习方向，AI 规划会基于目标来生成计划。
- AI 总结：让 AI 根据你一天的学习数据生成评分和总结。
- AI 规划：让 AI 根据目标和最近学习历史规划今天和本周的学习内容。

所有数据都存在本地 data/study-pulse.sqlite，不需要联网，不依赖云服务。

---

## 环境准备

### 必需软件

- Python 3.11+：后端运行环境。
- Node.js 20+：前端构建工具。
- npm：随 Node.js 一起安装。

### 可选软件

- ActivityWatch：从 https://activitywatch.net 下载安装。安装后启动它，StudyPulse 会自动连接 http://127.0.0.1:5600 读取数据，并在本机 localhost 与 127.0.0.1 之间自动回退。如果不安装 ActivityWatch，其他功能仍然可用，只是没有屏幕使用时间数据。

### 安装依赖

在项目根目录打开 PowerShell：

```powershell
# 创建 Python 虚拟环境（只需一次）
python -m venv .venv

# 激活虚拟环境
.\.venv\Scripts\Activate.ps1

# 安装后端依赖（含 MCP server 依赖）
npm run install:api

# 安装前端依赖
npm install
```

如果 PowerShell 提示脚本执行策略限制，先运行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 一键启动

最简单的方式，在项目根目录运行：

```powershell
.\start-study-pulse.ps1
```

这个脚本会自动：

1. 检查并创建 .venv（如果不存在）。
2. 安装缺失的前端和后端依赖。
3. 启动后端 API（http://127.0.0.1:7788）。
4. 启动前端开发服务器（http://127.0.0.1:5173）。
5. 打开浏览器。

或者用 npm：

```powershell
npm run start:local
```

---

## 手动启动

如果你需要分别控制后端和前端，可以手动启动。

### 启动后端

```powershell
npm run dev:api
```

后端会在 http://127.0.0.1:7788 运行，提供 REST API。

### 启动前端

另开一个终端：

```powershell
npm run dev:web
```

前端会在 http://127.0.0.1:5173 运行，在浏览器打开这个地址即可。

---

## 界面功能说明

左侧导航栏包含以下页面，支持中英文切换：

### 今日（Today）

快速查看今天的屏幕使用概览：总记录时长、活跃桶数、常用应用和窗口标题。页面底部还有后端运行状态和退出按钮。

### 日程记录（Schedule）

这是核心页面，按日期浏览完整的学习日常记录。选择任意日期后可以看到：

- 时间块：该日期的日程安排，可以添加和删除。
- 今日任务：该日期的任务列表及完成状态，支持勾选完成和删除。
- ActivityWatch 汇总：该日期的屏幕使用数据。
- 日志：该日期的学习日志，可以直接编辑保存。
- AI 总结：该日期已生成的 AI 总结（如果有）。

### 任务（Tasks）

今日任务工作台。可以添加今日任务、勾选完成、删除。AI 规划创建的任务也会出现在这里。你还可以在"日程记录"页面按日期查看任务及完成状态。

### 学习目标（Goals）

管理你的学习目标。创建时只需填写名称和描述（当前阶段已移除）。

每条目标右侧有操作按钮：
- ✨ **AI 补全描述**：点击后 AI 根据目标名称和已有描述生成详细学习路线（Markdown 格式），直接替换原描述
- 📌 **里程碑**：打开弹窗管理目标的里程碑列表。每个里程碑可设置标题和描述，支持勾选完成、编辑、删除。AI 规划时会参考里程碑进度，优先建议推进未完成的里程碑
- **暂停/激活**：暂停的目标不会出现在 AI 规划的选择列表中
- **删除**：删除目标及其所有里程碑

### AI 总结（AI Summary）

选择日期后点击"生成 AI 总结"，AI 会根据该日期的日程、日志、任务完成情况和 ActivityWatch 数据生成结构化总结，包括：

- 评分（0-100）
- 总结文字
- 亮点
- 阻碍
- 改进建议

同一天可以生成多次总结，会按时间倒序显示。

### AI 规划（AI Planning）

选择一个学习目标和日期后点击"生成 AI 规划"，AI 会根据目标、最近 7 天的学习记录、里程碑进度生成：

- **今日计划**：文字描述的学习内容安排（基于日志分析更具体）
- **推荐任务**：建议的今日任务列表，每项有 checkbox

任务不会直接写入数据库。勾选想要的任务后点击"确认添加"按钮才批量写入。写入后同时出现在"任务"页面的今日任务和"日程记录"页面对应日期的任务列表中。

你可以在"AI 配置"页或"设置"页填写自定义 AI 规划 prompt，覆盖默认提示词来控制 AI 如何规划。

### 今日日志（Journal）

独立的日志编辑页面，按日期编辑每日学习日志。

### AI 配置（AI Config）

配置 AI 提供商，详见下一节。

### 设置（Settings）

查看运行时配置和后端状态，可以在这里退出程序。

**界面设置**：可开关"日程记录中显示任务删除按钮"，默认开启。

---

## 配置 AI 提供商

在"AI 配置"页面可以选择以下提供商：

### Mock（默认）

不需要 API Key，生成的是固定格式的模拟内容。适合测试整个流程是否通畅。

### OpenAI 兼容

任何兼容 OpenAI Chat Completions API 的服务都可以用。填写：

- Endpoint：API 地址，例如 https://api.openai.com/v1
- Model：模型名称，例如 gpt-4.1-mini
- API Key：你的密钥

### DeepSeek

选择 DeepSeek 后会自动填入默认地址 https://api.deepseek.com/v1。你只需要填 API Key 和模型名称（例如 deepseek-chat）。

### Ollama

用于本地运行的 Ollama。默认地址 http://localhost:11434，不需要 API Key。

### 测试连接

配置完成后点击"测试连接"按钮，会发送一个最小请求验证 API 是否可用。如果返回 OK 说明配置正确。

### 隐私选项

"允许把 ActivityWatch 窗口标题发送给 AI"开关控制是否把你的窗口标题（可能包含文件名、网页标题等）发给 AI。关闭后 AI 仍然能看到应用名称和使用时长，但看不到具体标题。

### 自定义 AI 规划提示词

在 AI 配置页面底部的"AI 规划提示词"文本区，你可以填写自定义 prompt，控制 AI 如何生成每日计划。如果留空则使用默认 prompt。填写的 prompt 会附加 JSON 格式要求，确保 AI 返回正确的数据结构。

---

## MCP Server 接入外部 AI

StudyPulse 提供了一个 MCP（Model Context Protocol）server，让外部 AI 客户端（如 Claude Desktop、Cursor、Codex 等）能直接读写你的学习数据。

### 安装 MCP 依赖

```powershell
npm run install:api
```

这会安装 mcp 包。如果之前已经装过可以跳过。

### MCP Server 可用工具

| 工具 | 说明 |
------|------|
| read_journal | 读取某天的学习日志 |
| write_journal | 写入某天的学习日志 |
| read_day_record | 读取某天的完整学习记录（日志、日程、ActivityWatch、AI 总结、任务） |
| list_recent_records | 列出最近 N 天的学习记录 |
| list_goals | 列出所有学习目标 |
| create_goal | 创建新的学习目标 |
| list_tasks | 列出所有任务 |
| create_task | 创建新任务 |
| toggle_task | 切换任务完成状态 |
| read_ai_summaries | 读取某天的 AI 总结 |

### 在 Claude Desktop 中配置

找到 Claude Desktop 的配置文件：

- Windows: %APPDATA%\Claude\claude_desktop_config.json
- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json

添加以下内容：

```json
{
  "mcpServers": {
    "study-pulse": {
      "command": "D:\\try\\xm\\.venv\\Scripts\\python.exe",
      "args": ["-m", "apps.mcp.server"],
      "cwd": "D:\\try\\xm"
    }
  }
}
```

注意把路径替换成你的实际项目路径。重启 Claude Desktop 后，它就能调用 StudyPulse 的工具来读写你的学习数据了。

### 在 Cursor 中配置

在 Cursor 的 Settings > MCP 中添加一个新的 MCP server，填入：

- Command: D:\try\xm\.venv\Scripts\python.exe
- Args: -m apps.mcp.server
- Working Directory: D:\try\xm

### 在 Codex 中配置

在 Codex 的 MCP 配置中添加同样的 server 信息。Codex 支持 stdio 类型的 MCP server。

### 使用示例

配置好之后，你可以直接对 AI 说：

- "帮我读一下今天的学习日志" - AI 会调用 read_journal
- "把今天的学习笔记写进去：学习了 Transformer 的注意力机制" - AI 会调用 write_journal
- "看看我最近 7 天的学习记录" - AI 会调用 list_recent_records
- "帮我列一下所有学习目标" - AI 会调用 list_goals
- "创建一个新任务：复习 attention 代码" - AI 会调用 create_task
- "帮我看看昨天的 AI 总结" - AI 会调用 read_ai_summaries

AI 会自动决定调用哪个工具，你不需要手动选择。

### 手动测试 MCP Server

```powershell
npm run mcp:server
```

这会以 stdio 模式启动 MCP server。正常情况下不会有输出（它在等待 MCP 协议消息）。按 Ctrl+C 退出。

---

## 常见问题

### 后端打开显示 Not Found

如果你直接访问 http://127.0.0.1:7788 根路径，现在会显示状态信息。API 路径都在 /api/ 下，前端页面在 http://127.0.0.1:5173。

### ActivityWatch 数据不显示

确认 ActivityWatch 已经启动，浏览器访问 http://127.0.0.1:5600 能打开。StudyPulse 默认连接这个地址，并会自动尝试 localhost 回退。如果你的 ActivityWatch 运行在其他地址，可以通过环境变量 STUDY_PULSE_ACTIVITYWATCH_URL 修改，修改后需要重启后端。

### AI 测试连接返回 403 或 Cloudflare 错误

这通常是你填的 API 地址不对，或者该服务有地域/访问限制。确认 endpoint 地址正确，不需要在末尾加 /chat/completions，后端会自动拼接。

### AI 规划生成的内容为空

如果 AI 返回的格式和预期不一致，后端会做容错处理。如果仍然为空，检查 AI 配置页面是否选对了提供商和模型，点击"测试连接"确认 API 可用。

### 前端页面白屏

检查后端是否在运行（http://127.0.0.1:7788/api/health 应返回 JSON）。如果后端没启动，前端会显示"API 离线"。启动后端：npm run dev:api。

### 数据存在哪里

所有数据存在 data/study-pulse.sqlite。这个文件在 .gitignore 中被忽略，不会被提交到 git。如果你想备份数据，复制这个文件即可。

### 如何退出程序

在"今日"页面或"设置"页面底部有"退出程序"按钮，点击后会停止后端和前端进程。也可以直接关闭运行后端和前端的终端窗口。

### 如何更新项目

```powershell
git pull origin master
npm run install:api
npm install
```

然后重新启动即可。数据库会自动升级表结构（如果有新增表）。
