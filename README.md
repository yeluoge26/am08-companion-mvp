# AM08 Companion MVP

AI 陪伴平台 MVP，支持简体中文与英语。包含前后端、独立运营后台、自动化测试，以及运行所需的本地图片、视频、字体和目录数据。素材用于用户已授权的非商用项目，不附带再分发或商用许可。

## 本地运行

需要 Node.js 24 或以上；无第三方 npm 运行依赖。

1. 复制 `.env.example` 为 `.env`。
2. 按需填写 `OPENAI_API_KEY`，以及首次创建管理员所需的 `ADMIN_EMAIL`、`ADMIN_PASSWORD`。
3. 执行 `node --env-file=.env server.mjs`。
4. 前台：`http://127.0.0.1:4180/`；独立后台：`http://127.0.0.1:4180/admin/`。

首次运行会初始化 SQLite 数据库，默认保存到 `data/`。仓库不包含生产数据库、真实密钥、部署凭据或测试用户数据。管理员不开放公开注册。前后台使用独立登录 Cookie。

最新进度见 [V1.1-PROGRESS.md](V1.1-PROGRESS.md)。

## 功能

- 注册登录、会话、私有角色、收藏与聊天历史。
- OpenAI 流式文字聊天、按角色隔离的长期记忆与可编辑记忆卡、免费成功回复限额及会员付费墙。
- 独立运营后台：用户停用/恢复、角色发布/归档、人设编辑、套餐定价、订单、账本和审计。
- 订单价格与权益快照、签名支付回调、幂等入账、外部退款登记和争议处理。
- 角色独立关系成长：等级、经验进度、纪念日、关系卡与后台成长规则。
- 中英文界面与本地图片、视频预览。

真实支付和邮件需要自行配置。退款登记不执行资金转账；没有自动续费扣款。图片、语音和视频生成尚未接入。项目不保证与参考站功能完全一致。

## 验证

```sh
npm test
npm run check
```

测试使用独立临时数据库，覆盖权限、前后台会话隔离、CSRF、流式输出、记忆、限额、定价快照、退款与账本一致性。当前 37 项通过。

## 工程结构

- `server.mjs`：HTTP 服务、认证、数据库及静态资源。
- `management.mjs`：用户、官方角色、套餐与订单运营接口。
- `operations.mjs`、`chat-handler.mjs`、`ai-provider.mjs`：聊天配置、流式输出、记忆与模型适配。
- `public/`：前台、独立后台、多语言、目录及本地素材。
- `tests/`：自动化测试。
- `scripts/operator.mjs`：管理员及备份命令。
- `scripts/update-production.py`：现有服务器的代码增量发布；SSH 密码从环境变量读取。
- `ADMIN-DELIVERY.md`、`OPERATIONS.md`、`API.md`：交付说明与接口资料；历史说明以当前代码为准。

`prepare.py`、`build-static.py`、`release.py` 是原始静态归档辅助工具，依赖相邻的 `candy-static` 抓取工程和 Python BeautifulSoup。正常运行当前 MVP 不需要该工程或 Python。

## 部署

单实例 SQLite 应用，生产环境需要 HTTPS 反向代理、持久化数据目录与定期备份。设置正确的 `PUBLIC_ORIGIN`、`NODE_ENV=production`；密钥仅留在服务器环境配置中。现有部署工具针对当前 AM08 主机，迁移到其他主机前修改目标配置。
