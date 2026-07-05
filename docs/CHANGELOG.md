# Changelog

## v0.5 (2026-07-05)

- **导航重命名**：日程→日程记录，日志→今日日志
- **日程记录新增今日任务**：按日期查看当天任务及完成状态，支持勾选完成
- **AI 规划直接创建任务**：不再保存到中间表，生成后直接写入 tasks 表，删除 ai_plans/ai_plan_suggested_tasks
- **ActivityWatch 增强**：默认地址改为 127.0.0.1:5600，自动回退到 localhost；修复 Windows "未知应用" Bug（支持 application 字段）
- **数据库清理**：删除废弃的 ai_plans 和 ai_plan_suggested_tasks 表
