> Current release: streaming, long-term memory and trial/paid access are implemented. See OPERATIONS.md for the current message protocol and configuration endpoints; earlier non-streaming and model-disabled notes describe previous/unconfigured modes.

# 本地后端接口

Base URL: `http://127.0.0.1:4180`。实现位于 `server.mjs`，数据持久化在 `data/app.sqlite`。这些是真实接口，不是静态假数据。

请求体使用 JSON。写操作需要 `Origin: http://127.0.0.1:4180`；登录后还需保留服务端 `sid` Cookie，并发送登录响应或 `GET /api/me` 返回的 `csrf`，请求头为 `X-CSRF-Token`。前端已自动处理。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 健康状态和模型接入状态 |
| POST | `/api/auth/register` | 注册：`name,email,password,adult:true`；密码 12–128 字符 |
| POST | `/api/auth/login` | 登录：`email,password` |
| POST | `/api/auth/logout` | 注销并撤销会话 |
| POST | `/api/auth/password` | 修改密码：`currentPassword,password` |
| POST | `/api/auth/forgot` | 申请重置：`email` |
| POST | `/api/auth/reset` | 重置密码：`token,password` |
| GET/PATCH | `/api/me` | 当前用户、CSRF、余额、会员；PATCH 更新 `name` |
| GET | `/api/me/export` | 导出当前用户数据 |
| GET | `/api/characters` | 列表，可用 `q` 和 `category=girls/anime/guys` |
| POST | `/api/characters` | 创建私有角色：`name,age,style,gender,image,description,personality,voice` |
| GET/DELETE | `/api/characters/:id` | 查看/删除角色；删除仅限本人创建 |
| GET | `/api/favorites` | 当前用户收藏 |
| PUT/DELETE | `/api/favorites/:id` | 收藏/取消收藏角色 |
| GET/POST | `/api/conversations` | 会话列表；POST 传 `characterId` |
| GET/DELETE | `/api/conversations/:id` | 会话与消息详情/删除 |
| POST | `/api/conversations/:id/messages` | 保存消息：`content` |
| GET | `/api/plans` | 会员方案 |
| GET/POST | `/api/orders` | 订单列表/创建；POST 传 `plan`，附 `Idempotency-Key` |
| POST | `/api/orders/:id/cancel` | 取消待支付订单 |
| GET | `/api/wallet` | 余额与账本 |
| POST | `/api/subscription/cancel` | 标记不续费 |
| POST | `/api/billing/webhook` | 签名支付回调，验签格式见 README |
| GET | `/api/admin/summary` | 管理员统计 |
| GET | `/api/admin/users` | 用户列表（不返回密码哈希） |
| GET | `/api/admin/orders` | 全站订单 |
| GET | `/api/admin/audit` | 审计日志 |
| POST | `/api/admin/credits` | 积分调整：`userId,delta,reason`，附 `Idempotency-Key` |
| POST | `/api/admin/orders/:id/settle` | 人工确认测试订单：`reason`；仅管理员且需启用配置 |
| POST | `/api/generate` | 当前明确返回 503；未接模型、不扣积分 |

`style` 为 `Realistic` 或 `Anime`，`gender` 为 `female` 或 `male`。私有角色年龄 18–100；`image` 必须来自现有角色目录，不接受任意外部地址。

本地 `.env` 已开启人工订单确认和邮件 outbox，方便验收：这不会实际收款，也不会向外发送邮件。重置邮件写入 `data/outbox`，其中的链接可在本地浏览器测试。账号与消息权限由后端检查；普通用户无法使用管理员接口。

## 浏览器控制台调用示例

在本地站点登录后，可以运行以下代码创建会话并保存消息：

```js
const me = await fetch('/api/me').then(r => r.json());
const catalog = await fetch('/api/characters').then(r => r.json());
const headers = {'Content-Type': 'application/json', 'X-CSRF-Token': me.csrf};
const {conversation} = await fetch('/api/conversations', {
  method: 'POST', headers,
  body: JSON.stringify({characterId: catalog.characters[0].id})
}).then(r => r.json());
await fetch(`/api/conversations/${conversation.id}/messages`, {
  method: 'POST', headers,
  body: JSON.stringify({content: '测试消息持久化'})
}).then(r => r.json());
```

浏览器会自动附带同源 Cookie 和 Origin。聊天接口当前返回 `modelEnabled:false`，只保存用户消息；AI 回复需要后续接入模型。


## OpenAI chat integration update

Set OPENAI_API_KEY only in the private .env file; OPENAI_MODEL defaults to gpt-4.1-mini. Restart the server after changes. GET /api/health, /api/me and conversation responses expose modelEnabled (configuration state, not a provider health guarantee).

POST /api/conversations/:id/messages persists the user message and, when configured, calls OpenAI Responses with the latest 20 messages, store:false and max_output_tokens:500. It returns message, assistantMessage (nullable), replyError (nullable), modelEnabled. Provider failures keep the user message and return a safe error with HTTP 201; do not automatically resend the user message. Replies are stored with role assistant. One reply at a time per conversation; another write returns 409. A migration preserves existing messages.

This implements non-streaming general companion chat, not long-term memory or image/voice/video generation. Test mode does not deduct site credits; provider API costs still apply. Secrets and provider response bodies are not sent to clients.
