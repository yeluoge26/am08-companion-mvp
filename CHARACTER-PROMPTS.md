# 角色 Prompt 推导草稿

本次不替换图片或视频，不抓取新素材，不调用外部模型。现有目录包含 316 个角色，其简介均为占位文本，设置没有提供性格资料。原抓取脚本还替换过部分长篇介绍，所以无法还原原站隐藏 Prompt。

## 本次结果

- 316 份中文结构化 Prompt，按角色 ID 对应，支持随用户语言回复。
- 55 个保存页面保留了可提取的开场文字，其他页面主要留下截断预览。
- 32 个角色能识别出保守的措辞线索（羞涩、轻快、好奇、舒缓、奇幻或科技感），可信度仍为 limited。
- 其余 284 个标为 insufficient：只使用保守陪伴设定，不随机分配职业、爱好、国籍或虚构经历。它们不是 284 份已充分还原的独特人设。
- 全部 needsReview=true。同名真人不代表本人；目录年龄不作为真人年龄使用。

## 文件与编辑

`character-personas.json` 是完整草稿清单，包含 Prompt、来源文件名、源文件 SHA-256、证据类型、语气线索和可信度。它位于服务端根目录，不放进 public 目录。没有复制原页面的完整开场对白。

导入后在运营后台的官方角色编辑页修改「Character persona prompt」。聊天现有适配层已经读取此字段。源清单的 needsReview 是人工审阅标记，不代表后台新增了审核流程。

每份 Prompt 包含角色身份、对话风格、互动方式、关系与记忆、未知信息、边界与来源说明。视觉样式只来自目录，不从外貌推断性格。

## 重建与导入

需要 Python 和 beautifulsoup4，以及原有本地页面快照：

```powershell
python scripts/derive-character-prompts.py
node scripts/apply-character-prompts.mjs
node scripts/apply-character-prompts.mjs --apply
```

默认仅预览。显式导入先备份数据库，以事务写入，仅补齐目录对应的官方角色空 Prompt；跳过已有 Prompt 和用户私有角色，不修改素材、简介、其他 settings 或发布状态。每条更新写入操作审计并增加后台版本，避免旧编辑页覆盖变更。重复执行不会覆盖人工修改。数据库位置可由 DATA_DIR 指定。

本批草稿先供本地试聊与人工修订，不把缺少依据的推断宣称为完成的原站复刻。
