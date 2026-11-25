(() => {
'use strict';
// Exact UI phrases only. User-authored content is explicitly marked translate="no".
const zh = Object.fromEntries(`Staff accounts|员工账号
Create staff account|创建员工账号
Super administrator|超级管理员
Operations|运营
Reviewer|审核
Finance|财务
Support|客服
Access audit|接口访问审计
Actor|操作人
Method|方法
Path|路径
Details|详情
Read only|只读
Initial password|初始密码
Reset password|重置密码
Disabled|已停用
Staff permission required|没有此操作的权限
Staff account is disabled|员工账号已停用
Invalid staff role or status|员工角色或状态无效
Staff account not found|员工账号不存在
You cannot change your own role or disable yourself|不能修改自己的角色或停用自己
At least one active super administrator is required|必须保留至少一名可用超管
Use staff management for employee accounts|请在员工账号页面管理此账号
Latest 200 requests. Request bodies and passwords are never recorded.|最近 200 条请求，不记录请求正文和密码。
Up to 100 matching accounts. Search by name or email.|最多显示 100 个匹配账号，可按姓名或邮箱搜索。
Review queue|审核队列
User appeals|用户申诉
Reports and appeals|举报与申诉
Review appeal|审核申诉
Submit appeal|提交申诉
Appeal reason|申诉理由
Appeal submitted|申诉已提交
Your appeal|我的申诉
Waiting for review|等待审核
Review history|审核记录
Original decision|原处理结论
Content action|内容处置
Content action:|内容处置：
No restriction|不限制内容
Warn author|警告作者
Hide message|隐藏消息
Take character offline|角色下架
Withdrawn|已撤销
All categories|所有类型
Message|消息
Character|角色
upheld|维持原判
overturned|改判
superseded|原决定已变更
none|无处置
warn|警告
hide|隐藏
reported|已举报
decided|已审核
appealed|已申诉
appeal-reviewed|申诉已审核
Content unavailable|内容不可用
[Content removed after review]|[内容经审核已隐藏]
Content removed after review|内容经审核已隐藏
Only reported excerpts are available. No access to full conversations.|仅展示举报片段，不能访问完整聊天。
Latest 100 reports and content decisions affecting your account. One appeal per person per report.|显示最近 100 条与您相关的举报和处置，每人每条举报可申诉一次。
Hiding a message also clears this character’s learned memory. Appeals do not restore cleared memory.|隐藏消息会同时清空该角色已学习的记忆；申诉改判不会恢复已清空的记忆。
Overturning withdraws this restriction, or reopens a dismissed report. Other active restrictions remain.|改判会撤销本次限制，或重新开启已驳回的举报；其他有效限制不受影响。
Content is already under moderation|该内容已被处置
Invalid moderation decision|审核状态或处置组合无效，驳回举报时应选择不限制内容
This content has no user author|该内容没有用户作者，不能发送作者警告
Content no longer exists|内容已不存在
Wait for the review decision|请等待审核结论后再申诉
An appeal has already been submitted|您已提交过申诉
Another reviewer must handle this appeal|请由其他审核员处理该申诉，或由超管复核
Appeal not found|申诉不存在
Awaiting review|待审核
Awaiting appeal review|待处理申诉
Home|首页
Discover|发现
Shorts|短视频
Chat|聊天
Chats|聊天列表
Collection|收藏
Create Character|创建角色
Create|创建
My AI|我的角色
Media Library|素材库
Premium|会员
70% OFF|优惠 70%
Tokens & orders|额度与订单
Settings|设置
Sign in|登录
Administration|管理后台
Legal Terms|法律条款
Help Center|帮助中心
Help center|帮助中心
Non-commercial preview · AI not connected|非商用预览 · AI 尚未接入
Independent non-commercial replica · model API disabled|独立非商用复刻 · 模型 API 未启用
Terms & privacy|条款与隐私
Affiliate|推广合作
Local media|本地素材
Toggle navigation|展开或收起导航
Categories|分类
Mobile navigation|移动导航
Account settings|账号设置
Search characters|搜索角色
Search characters, shorts, creators…|搜索角色、短视频、创作者…
♀ Girls|♀ 女性
♂ Guys|♂ 男性
◎ Anime|◎ 动漫
Girls|女性
Guys|男性
Anime|动漫
Realistic|写实
FEATURED|精选
ANIME|动漫
MY AI|我的角色
Add to collection|加入收藏
Remove from collection|取消收藏
No characters yet|暂无角色
Create a character or browse the collection.|创建角色或浏览收藏。
⌕  Search|⌕  搜索
Search|搜索
Sort by name|按名称排序
Featured promotions|精选活动
Featured character banner|精选角色横幅
Explore Now|立即探索
Previous banner|上一张横幅
Next banner|下一张横幅
Explore|探索
Featured Characters|精选角色
Chat, call and create with your AI companion|与 AI 伙伴聊天、通话和创作
View all characters|查看全部角色
Video Previews|视频预览
View all|查看全部
Your next character, your imagination|发挥想象，创建专属角色
Choose a style, personalize a character, and build your collection.|选择风格、自定义角色，建立你的收藏。
FAQ|常见问题
What is included in this version?|当前版本包含哪些功能？
You can browse local characters and previews, create a profile, save favorites, and store conversations.|你可以浏览本地角色与预览、创建角色、收藏并保存会话。
Are AI replies connected?|已接入 AI 回复吗？
Not yet. Your messages are saved, but this version does not generate replies, images, voice, or video.|暂未接入。消息会保存，但当前版本不生成回复、图片、语音或视频。
Are the videos stored locally?|视频保存在本地吗？
Yes. The included public preview videos, images, icons and fonts are served from the local asset directory.|是的，包含的公开预览视频、图片、图标和字体均从本地素材目录加载。
Will selecting a plan charge me?|选择套餐会扣款吗？
No payment is collected by this MVP itself. An order remains pending until an operator confirms settlement or a configured billing adapter sends a verified event.|此 MVP 本身不收款。订单保持待支付状态，直到管理员确认结算或支付适配器发送已验证的通知。
Is this the original Candy AI website?|这是 Candy AI 官方网站吗？
No. This is a non-commercial replica and MVP implementation. It is not operated by the source website.|不是。这是非商用复刻与 MVP，由独立部署者运行。
Save MP4|保存 MP4
YOUR CHARACTER|你的角色
FEATURED CHARACTER|精选角色
Companion|伙伴
Start conversation|开始聊天
♥ Saved|♥ 已收藏
♡ Save|♡ 收藏
AI responses are not connected. Conversations can be created and messages saved.|AI 回复尚未接入，可以创建会话和保存消息。
Public video preview|公开视频预览
Download local MP4|下载本地 MP4
Delete this character|删除此角色
Create your account|创建账号
Welcome back|欢迎回来
Log in|登录
Sign up|注册
Name|名称
Email|邮箱
Password|密码
At least 12 characters.|至少 12 个字符。
I am at least 18 and agree to the|我已年满 18 岁，并同意
terms and privacy notice|条款与隐私声明
Create account|创建账号
Forgot your password?|忘记密码？
Need account recovery? Contact the deployment operator. Email recovery is not configured in this build.|需要找回账号？请使用找回密码入口，或联系部署管理员。
Create my AI Girl|创建我的女性 AI 角色
Create my AI Guy|创建我的男性 AI 角色
Make a character that is uniquely yours|创建属于你的独特角色
Appearance|外观
Choose a portrait from the local library. Image generation will be connected later.|从本地素材库选择头像，图片生成将在后续接入。
Age|年龄
Personality|性格
Friendly|友善
Creative|富有创意
Thoughtful|体贴
Adventurous|热爱冒险
Playful|活泼
Calm|沉稳
About your character|角色简介
Give your character a name|为角色起个名字
Interests, background and conversation style|兴趣、背景和聊天风格
Voice generation is not connected in this version.|此版本尚未接入语音生成。
Character preview|角色预览
Your new companion.|你的新伙伴。
Your character will be private to your account. The selected portrait comes from the existing local library.|角色仅对你的账号可见。所选头像来自现有本地素材库。
Back|上一步
Next|下一步
Choose your|选择你的
Plan|套餐
Membership and tokens for your companion experience|会员与额度，丰富你的伙伴体验
12 Months|12 个月
3 Months|3 个月
1 Month|1 个月
70% OFF · BEST VALUE|优惠 70% · 超值之选
35% OFF|优惠 35%
FIRST MONTH|首月
/month|/月
Get Started|立即开始
These are configurable demonstration plans based on the captured public page. No recurring billing is active. AI generation, voice and live video are not connected.|这些是参考公开页面的可配置演示套餐，未启用自动扣款。AI 生成、语音和实时视频尚未接入。
Included in this MVP|此 MVP 包含
✓ Private character profiles|✓ 私有角色资料
✓ Persistent conversations|✓ 会话持久保存
✓ Saved collections|✓ 角色收藏
✓ Local preview media library|✓ 本地预览素材库
✓ Order history and token ledger|✓ 订单历史和额度账本
✓ Account data export|✓ 账号数据导出
Order|订单
Customer|客户
Total|合计
Status|状态
Action|操作
Confirm settlement|确认结算
Cancel|取消
No orders yet.|暂无订单。
Available tokens|可用额度
No credits are deducted while model APIs are disabled.|模型 API 未启用时不会扣除额度。
View plans|查看套餐
Membership|会员状态
No active membership|暂无有效会员
Disable renewal|关闭续订
Pending orders do not activate membership.|待支付订单不会激活会员。
Orders|订单
Token history|额度记录
Date|日期
Change|变动
Reason|原因
No token transactions.|暂无额度记录。
monthly|月度套餐
quarterly|季度套餐
annual|年度套餐
pending|待支付
paid|已支付
cancelled|已取消
active|有效
Subscription allocation|订阅额度发放
New chat|新建聊天
Saved conversation|已保存的会话
Your conversations will appear here.|你的会话会显示在这里。
Explore characters|探索角色
Back to chats|返回会话列表
Conversation saved locally on the server|会话保存在本地服务器
Delete|删除
Model API is not connected. Messages are saved; no AI reply or credit charge is generated.|模型 API 尚未接入。消息会保存，不生成 AI 回复，也不扣除额度。
Start your conversation.|开始聊天吧。
Your messages will stay here.|消息会保存在这里。
Write a message…|输入消息…
Message|消息
Send|发送
Your conversations|你的会话
Select a character to get started.|选择一个角色开始聊天。
Set a new password|设置新密码
Reset your password|重置密码
Reset links expire after 15 minutes and can only be used once.|重置链接 15 分钟后失效，且只能使用一次。
Enter your account email to request a reset link.|输入账号邮箱以申请重置链接。
New password|新密码
Reset password|重置密码
Send reset link|发送重置链接
Back to login|返回登录
Profile|个人资料
Save changes|保存修改
Security|账号安全
Current password|当前密码
Change password|修改密码
Your data|你的数据
Export your profile, characters, conversations, messages and billing records.|导出个人资料、角色、会话、消息和账单记录。
Export my data|导出我的数据
Log out|退出登录
Administrator access required|需要管理员权限
This area is restricted to the deployment operator.|此区域仅供部署管理员访问。
Accounts, orders and operational records|账号、订单与操作记录
Users|用户
Characters|角色
Conversations|会话
Pending orders|待支付订单
Role|身份
Tokens|额度
Adjust|调整
Audit trail|审计日志
Time|时间
Target|对象
admin|管理员
user|普通用户
account.created|创建账号
local-test-admin.created|创建本地测试管理员
credits.adjusted|调整额度
order.paid|订单已支付
order.manually-settled|人工确认结算
password.changed|修改密码
password.reset|重置密码
Independent non-commercial implementation|独立非商用实现
This installation is a replica for authorized non-commercial use. It is not the original Candy AI service. Source-site names and media remain the property of their respective owners.|此部署用于已授权的非商用复刻，并非原始 Candy AI 服务。原站名称及媒体素材归各自权利人所有。
Accounts and data|账号与数据
On the MVP server, account details, password hashes, sessions, characters, messages, favorites, orders and audit records are stored in a local SQLite database. Passwords are salted and hashed; they are not stored in plain text. On the static preview, demo data is stored in your browser only.|MVP 将账号资料、密码哈希、登录会话、角色、消息、收藏、订单与审计记录保存在本地 SQLite 数据库中。密码经过加盐哈希处理，不以明文保存。静态预览的演示数据仅保存在浏览器内。
AI and billing|AI 与计费
Model APIs are disabled. Messages are stored without an AI response. Demonstration prices are configurable and no payment is collected by this app itself. An external payment provider and verified callback must be configured before taking payments.|模型 API 未启用，只保存消息，不生成 AI 回复。演示价格可配置，应用本身不收款。收款前需要配置外部支付服务及经过验证的回调。
Before public launch|公开上线前
The deployment operator must supply their legal entity, contact details, applicable terms, privacy notices, retention policy and payment terms. This page documents the current build; it is not a substitute for those operator-specific documents.|部署者需要提供主体信息、联系方式、适用条款、隐私声明、数据保留政策及支付条款。本页描述当前实现，不能代替部署者自己的正式文件。
Help|帮助
Account recovery and data deletion requests should be directed to the deployment operator. No external support team is connected.|账号恢复与数据删除请联系部署管理员，当前未接入外部客服。
Explore Anime Characters|探索动漫角色
Explore AI Guys|探索男性 AI 角色
Explore AI Girls|探索女性 AI 角色
Find your next companion|寻找你的下一位伙伴
Character not found|找不到角色
This profile is unavailable.|该角色资料不可用。
Go home|返回首页
Characters, previews and new experiences|角色、预览与新体验
For you|为你推荐
Video previews|视频预览
Create your own|创建专属角色
Featured characters|精选角色
Public preview clips · stored locally|公开预览短片 · 本地保存
Your collection|你的收藏
All your saved companions, in one place|在这里查看所有收藏的伙伴
Your collection is waiting|收藏夹还是空的
Tap the heart on a character to save it here.|点击角色上的爱心即可收藏。
Create your first companion|创建你的第一个伙伴
Choose a style and make it your own.|选择风格，打造专属角色。
Account support|账号支持
Contact the operator of this installation for account recovery, data export or deletion requests. Original-site customer support is not connected to this installation.|找回账号、导出或删除数据，请联系此部署的管理员。此部署未接入原站客服。
Partner program|合作计划
The source site’s affiliate page is preserved in the static snapshots. This MVP does not run an affiliate program or pay commissions.|原站推广页面保留在静态快照中。此 MVP 不运营推广计划，也不支付佣金。
Explore the platform|探索平台
Create an image or video|创建图片或视频
Describe your scene|描述场景
Describe an environment, outfit or portrait|描述环境、服装或肖像
Model API integration is intentionally disabled. No generation requests are submitted and no tokens are deducted.|模型 API 暂未启用，不会提交生成请求或扣除额度。
Generation unavailable|生成功能尚不可用
Local media library|本地素材库
Videos|视频
Character portraits|角色头像
Page not found|页面不存在
Choose a page from the sidebar.|请从侧边栏选择页面。
Unable to load this page|无法加载此页面
Try again|重试
Close|关闭
Signed in successfully|登录成功
No matching characters.|没有匹配的角色。
Profile updated|资料已更新
Password changed; other sessions have been signed out|密码已修改，其他会话已退出
Password reset. Please sign in with your new password.|密码已重置，请使用新密码登录。
Removed from collection|已取消收藏
Saved to collection|已加入收藏
Choose an age between 18 and 100|请选择 18 至 100 岁之间的年龄
Your character has been created|角色已创建
Delete character?|删除角色？
This will also delete the character’s conversations. This cannot be undone.|这也会删除该角色的会话，操作无法撤销。
Delete character|删除角色
Delete this conversation?|删除此会话？
All messages in this conversation will be deleted.|此会话中的所有消息都将被删除。
Delete conversation|删除会话
Review your order|确认订单信息
This creates an unpaid order. No card details are collected and no payment is taken here.|此操作创建未支付订单，不收集银行卡信息，也不会在此扣款。
Create order|创建订单
Order created|订单已创建
Continue to payment|继续支付
Your order is pending. Continue to the configured payment provider.|订单待支付，请继续前往已配置的支付服务。
Open checkout|打开收银台
Renewal disabled|已关闭续订
Confirm external settlement|确认外部结算
Only confirm after payment has been verified outside this application. This action grants membership and tokens once.|仅在应用外核实付款后确认。此操作会一次性发放会员与额度。
Receipt or reason|凭证或原因
Enter a receipt or verification reason|请输入凭证或核实原因
Adjust token balance|调整额度余额
Adjustment|调整数量
Record adjustment|记录调整
Adjustment recorded|调整已记录
Unable to connect|无法连接
Loading your companions…|正在加载伙伴…
Please sign in|请先登录
Request failed|请求失败
Invalid text field|文本字段无效
Password must contain 12–128 characters|密码长度须为 12 至 128 个字符
Invalid email address|邮箱格式无效
Too many attempts. Try again later.|尝试次数过多，请稍后再试。
This email is already registered|此邮箱已注册
Invalid email or password|邮箱或密码不正确
Current password is incorrect|当前密码不正确
Invalid CSRF token|登录验证已过期，请刷新页面后重试
Origin not allowed|请求来源不被允许
Request too large|请求内容过大
Email delivery is not configured|尚未配置邮件发送服务
Reset link is invalid or expired|重置链接无效或已过期
Conversation not found|找不到会话
Invalid credit adjustment|调整额度无效
User not found|找不到用户
Balance cannot be negative|余额不能为负数
Idempotency conflict|重复请求的参数不一致
This action requires the MVP server.|此操作需要启动 MVP 服务器。
Offline static preview · data stays in this browser · no real account or payment|离线静态预览 · 数据仅保存在此浏览器 · 无真实账号或付款
This is an offline demo. No real account is created and no password is stored.|这是离线演示，不会创建真实账号或保存密码。
Use any demo value; it will not be saved.|可填写任意演示密码，不会保存。
Enter offline demo|进入离线演示
Browser-local demo data is separate from MVP accounts.|浏览器中的演示数据与 MVP 账号相互独立。
Offline demo entered|已进入离线演示
Offline demonstration order only. No payment was collected.|仅为离线演示订单，未收取任何款项。
Please enter the offline demo first|请先进入离线演示
Offline preview has no password authentication. Use the MVP server for account security.|离线预览不提供密码认证，请在 MVP 服务中管理账号安全。
The offline demo has no stored passwords. Password recovery is available only on the MVP server with email configured.|离线演示不保存密码。密码找回仅在配置邮件服务的 MVP 中可用。
Model API is not connected. No credits have been deducted.|模型 API 尚未接入，未扣除额度。`.split('\n').map(line=>line.split('|')));
Object.assign(zh, {
 "Token store":"代币商店",
 "Reserved tokens":"冻结代币",
 "Monthly token limit":"每月代币消费上限",
 "Spent this month":"本月已消费",
 "Spending limit saved":"消费上限已保存",
 "Limit token consumption per UTC calendar month. This does not limit subscription or token-pack payments. Blank means no limit; zero blocks spending.":"按 UTC 自然月限制代币消耗，不限制购买会员或代币包的支付金额。留空表示不限，填 0 表示禁止消耗。",
 "Delete account":"注销账号",
 "I understand this cannot be undone":"我理解此操作不可撤销",
 "Account deleted":"账号已注销",
 "This permanently deletes your account, conversations, memories, characters and local order records. Any unused balance is lost. This does not issue a refund. Export your data first.":"此操作永久删除账号、会话、记忆、角色及本地订单记录，未用余额将作废，不会自动退款。请先导出数据。",
 "Report content":"举报内容",
 "Only this reported message will be shared with reviewers, not your full conversation.":"审核人员仅会看到这条被举报消息，不会看到完整会话。",
 "Submit report":"提交举报",
 "Report submitted":"举报已提交",
 "Content reports":"内容举报",
 "Reported excerpt":"被举报片段",
 "Resolution note":"处理说明",
 "resolved":"已处理",
 "dismissed":"已驳回",
 "Token consumption rules":"代币消耗规则",
 "Enable consumption rule":"启用消耗规则",
 "Generation providers are not connected. Rules configure future charges; enabling a rule does not enable generation.":"生成服务尚未接入。此处配置后续扣费规则，启用规则不会开放生成功能。",
 "Invalid monthly token limit":"每月代币消费上限无效",
 "Limit cannot be below spent and reserved tokens":"上限不能低于本月已消费与冻结的代币之和",
 "Monthly token limit reached":"已达到每月代币消费上限",
 "Insufficient tokens":"代币余额不足",
 "Confirm account deletion":"请确认注销账号",
 "Administrators cannot delete themselves":"管理员不能自行注销账号",
 "Wait for active requests to finish":"请等待正在进行的请求完成",
 "Report is already closed":"该举报已关闭",
 "Invalid pricing rule":"代币规则无效",
 "Only the reported content will be shared with reviewers, not your full conversation.":"审核人员仅会看到被举报内容，不会看到完整会话。",
 "No token packs are currently on sale.":"暂无上架的代币包。",
 "Generation services are not connected. No generation charges are currently collected.":"生成服务尚未接入，目前不收取生成费用。",
 "Image generation":"生成图片",
 "Voice message":"语音消息",
 "Avatar generation":"生成头像",
 "She remembers you":"她记得你",
 "Manage memory":"管理记忆",
 "Only this character can recall these memories.":"这些记忆只属于你和当前角色，不会分享给其他角色。",
 "Memory recall is paused":"记忆调用已暂停",
 "No memories yet. Add something you want this character to remember.":"还没有记忆。可以添加你希望这个角色记住的事情。",
 "Forget this memory":"忘记这条",
 "Allow this character to remember me":"允许当前角色记住我",
 "Write one memory per line. Automatic summaries may be imperfect; you can correct them.":"每行填写一条记忆。自动摘要可能不准确，你可以随时纠正。",
 "Reload saved memory":"重新加载已保存记忆",
 "Character memory settings":"角色记忆设置",
 "Enable character memory for my account":"允许此账号使用角色记忆",
 "Archived account memory":"旧版账号记忆（仅归档）",
 "Each character has separate memories. Manage them from the memory card in each chat. Old account memory below is archived and is never sent to characters automatically.":"每个角色拥有独立记忆，可在对应聊天的记忆卡中管理。下方旧版账号记忆仅保留供你查看，不会自动发送给任何角色。",
 "Editing memory does not remove old messages. Recent messages in this conversation can still be used as context.":"编辑记忆不会删除旧消息，当前会话的近期消息仍可能作为聊天上下文。",
 "Enable character memory in account settings to resume recall.":"请在账号设置中开启角色记忆，恢复记忆调用。",
 "Relationship":"关系成长",
 "Relationship card":"关系卡",
 "Level progress":"等级进度",
 "Experience":"经验值",
 "Days together":"相识天数",
 "Experience to next level":"距离下一级还需经验",
 "Highest level reached":"已达到最高等级",
 "Experience per successful reply":"每次成功回复经验",
 "Daily experience cap":"每日经验上限",
 "Earned today":"今日已获得",
 "Relationship growth is paused":"关系成长已暂停",
 "Daily limits reset at midnight UTC. Failed or repeated replies earn no experience. Badges are decorative and do not unlock paid features.":"每日额度按 UTC 零点重置，失败或重复请求不增加经验。徽章仅用于展示，不解锁付费功能。",
 "First meeting":"首次相识",
 "Next anniversary":"下次纪念日",
 "Days remaining":"剩余天数",
 "Level milestones":"成长里程碑",
 "Your next milestone is ahead.":"期待你的下一个成长里程碑。",
 "Our anniversaries":"我们的纪念日",
 "Anniversary title":"纪念日名称",
 "Add anniversary":"添加纪念日",
 "Remove":"移除",
 "Save anniversaries":"保存纪念日",
 "Anniversaries saved":"纪念日已保存",
 "Up to 10 dates. February 29 is observed on February 28 in non-leap years. Dates use UTC.":"最多保存 10 个日期。2 月 29 日在非闰年按 2 月 28 日纪念，日期按 UTC 计算。",
 "At most 10 anniversaries":"最多保存 10 个纪念日",
 "Invalid anniversary":"纪念日名称或日期无效",
 "Relationship growth":"关系成长",
 "Edit growth rules":"编辑成长规则",
 "Enable relationship growth":"启用关系成长",
 "Level":"等级",
 "Badge":"徽章",
 "Only successful replies earn experience. Daily caps apply per user and character in UTC. Existing levels never decrease; new thresholds apply on the next successful reply. Badges are decorative.":"仅成功回复增加经验，每个用户与角色分别按 UTC 日期限额。已获等级不降级，新门槛于下次成功回复生效。徽章为展示用途。",
 "Invalid growth rules":"成长规则无效",
 "Invalid growth levels":"等级门槛须递增，名称与徽章不能为空",
 "Operations data":"运营数据看板",
 "From date":"开始日期",
 "To date":"结束日期",
 "Apply date range":"应用日期范围",
 "Definitions and coverage":"统计口径与数据覆盖",
 "All dates use UTC. Administrators are excluded. Counts cover retained accounts and records; deleting an account or conversation may revise historical totals.":"所有日期按 UTC 统计，排除管理员账号。统计仅覆盖当前保留的账号与记录；删除账号或会话可能改变历史总数。",
 "Active means a registered user successfully used an authenticated frontend API or signed in. It is not anonymous traffic or page views. Repeated requests on the same day count once.":"活跃指注册用户成功登录或使用需登录的前台接口，不是匿名访客或页面浏览量。同一用户同一天仅计一次。",
 "Activity tracking started":"活跃记录启用时间",
 "First fully tracked UTC day":"首个完整记录日（UTC）",
 "Earlier activity is only a lower bound from registrations and retained chat records. Retention is shown only for fully tracked, completed observation days. Today's counts are provisional.":"此前活跃数据仅由注册与已保留的聊天记录推断，是已知下限。留存只在记录完整且已结束的观察日展示，今日数据尚未结算。",
 "DAU, WAU and MAU end on the selected end date and use 1, 7 and 30 calendar days. Retention means returning exactly 1, 7 or 30 days after registration.":"DAU、WAU、MAU 分别统计截至所选结束日期的 1、7、30 个自然日。留存指注册后第 1、7、30 天当天回访。",
 "The selected activity windows include incomplete historical tracking.":"所选活跃统计窗口包含历史记录不完整的日期。",
 "Registrations in range":"期间注册人数",
 "Retained users":"当前保留用户数",
 "Active users in range":"期间去重活跃人数",
 "DAU at range end":"结束日 DAU",
 "WAU at range end":"结束日 WAU",
 "MAU at range end":"结束日 MAU",
 "Registration and activity trend":"注册与活跃趋势",
 "Registrations":"注册人数",
 "Active users":"活跃人数",
 "Daily registrations and active users":"每日注册与活跃人数",
 "Chat usage":"聊天用量",
 "Attempts are grouped by request start time and show their current status. Retries are separate attempts. User messages count retained message records.":"请求按发起时间分组并显示当前状态，重试作为独立请求。用户消息数只统计保留的消息记录。",
 "User messages":"用户消息数",
 "Model attempts":"模型请求数",
 "Chat input tokens":"聊天输入 Token",
 "Chat output tokens":"聊天输出 Token",
 "Attempts with complete usage":"用量完整的请求",
 "Attempts with missing usage":"用量缺失的请求",
 "Token totals include only provider-reported usage. Missing usage is not estimated and these totals are not a billing statement.":"Token 仅累计服务商实际返回的用量；缺失部分不估算，此统计不等于服务商账单。",
 "Model":"模型",
 "Memory extraction usage":"记忆提取用量",
 "Only parsed provider responses recorded since this dashboard was installed are counted. Earlier memory usage and failed requests without usage are unavailable.":"仅统计本看板启用后记录的已解析服务商响应；此前记忆用量及未返回用量的失败请求无法补齐。",
 "Recorded memory responses":"已记录记忆响应",
 "Memory input tokens":"记忆输入 Token",
 "Memory output tokens":"记忆输出 Token",
 "Memory responses with missing usage":"用量缺失的记忆响应",
 "Token ledger statistics":"代币账本统计",
 "Consumption counts captured generation debits only. Refund reversals and administrative deductions are separate. Reserved tokens are the current unexpired balance, not a date-range total.":"消费仅统计生成任务实际扣账。退款冲回、人工扣回分开列示。冻结代币是当前尚未过期的冻结额，不是所选期间累计值。",
 "Token inflow":"代币入账",
 "Actual token consumption":"实际代币消费",
 "Refund reversals":"退款冲回",
 "Administrative deductions":"人工扣回",
 "Other deductions":"其他扣减",
 "Net token change":"代币净变动",
 "Currently reserved tokens":"当前冻结代币",
 "Daily detail":"每日明细",
 "Tracking coverage":"记录覆盖",
 "Complete day":"完整日",
 "Day in progress":"当日未结束",
 "Partial history":"历史不完整",
 "Registration cohort retention":"注册分组留存",
 "Each cell shows returning users and the percentage of that day's retained registrations.":"每格展示回访人数及其占该日当前保留注册用户的比例。",
 "Registration date":"注册日期",
 "Cohort size":"分组人数",
 "Not yet observable":"尚不可观察",
 "Insufficient tracking history":"历史记录不足",
 "Choose a valid date range of at most 93 days":"请选择有效日期范围，最多 93 天",
 'Administrator sign in':'管理员登录','Use your operator account to manage the platform.':'使用运营账号登录后台。','Overview':'概览','Administration sections':'后台管理栏目','User management':'用户管理','Official characters':'官方角色管理','Plans and pricing':'套餐与定价','Order management':'订单管理','All statuses':'全部状态','No records found':'暂无记录','Previous':'上一页','Details':'详情','Edit':'编辑','Portrait':'头像','Category':'分类','Sort rank':'排序权重','Create official character':'创建官方角色','Edit official character':'编辑官方角色','User details':'用户详情','Operation reason':'操作原因','Age confirmation:':'年龄确认：','Self-confirmed':'用户自我确认','Not separately recorded':'未单独登记','Source:':'来源：','Account status':'账号状态','Operator note':'运营备注','Revoke sessions':'退出所有会话','All sessions for this user will be signed out.':'此用户的所有登录会话都将退出。','Recent orders':'最近订单','Publication status':'发布状态','Style':'画风','Gender':'性别','female':'女性','male':'男性','published':'已上架','draft':'草稿','archived':'已归档','suspended':'已停用','Character description':'角色介绍','Character persona prompt':'角色人设指令','Tags':'标签','SEO title':'SEO 标题','SEO description':'SEO 描述','Archived characters are hidden from discovery and cannot start new replies. Existing conversation history is retained.':'归档角色不再公开展示，也不能发起新回复；已有会话历史会保留。',
 'Price changes affect new orders only. Existing orders keep their original price and benefits. No recurring payment is automatically collected.':'改价仅影响新订单，已有订单保留原价格和权益；系统不会自动发起续费扣款。','Create plan':'新增套餐','Edit plan':'编辑套餐','Plan ID':'套餐标识','Product type':'商品类型','Price':'价格','Currency':'币种','Token pack':'代币充值包','Subscription':'会员订阅','On sale':'已上架','Off sale':'已下架','Recommended':'推荐','Price in minor currency units':'价格（最小货币单位）','Reference price in minor units':'参考价格（最小货币单位）','Billing period unit':'计费周期单位','Billing period count':'周期数量','month':'月','week':'周','Tokens granted per purchase':'每次购买发放代币','Region label':'地区标签','Benefit descriptions':'权益说明','USD/CNY/EUR use cents; VND/KRW use whole currency units. Region is a display label, not a location restriction.':'美元、人民币和欧元以分为单位，越南盾和韩元以整数货币单位填写。地区仅作为展示标签，不会限制用户所在地。','No recurring payment is automatically collected. Token packs do not include membership.':'系统不会自动续费扣款，代币充值包不包含会员权益。','Choose membership or additional tokens. Prices apply to this purchase only.':'选择会员或代币充值包，展示价格适用于本次购买。',
 'Refund records confirm an external refund; this panel does not transfer money.':'退款记录用于确认已在外部完成的退款，此后台不会发起资金转账。','Dispute':'争议','none':'无','open':'处理中','closed':'已关闭','refunded':'已退款','Order details':'订单详情','Frozen order benefits':'下单时的权益快照','Cancel order':'取消订单','Only an unpaid pending order can be cancelled.':'仅能取消尚未支付的待支付订单。','Record external refund':'登记外部退款','Complete the refund with your payment provider first. This records a full refund, reverses this order\'s tokens and recalculates membership. No money is transferred here.':'请先在支付服务商完成退款。此操作登记全额退款、冲回该订单代币并重算会员有效期，不会在此转账。','External refund reference':'外部退款凭证编号','I verified the full refund was completed externally':'我已核实全额退款已在外部完成','Refund reference:':'退款凭证：','Manage dispute':'管理争议','Dispute status':'争议状态','External dispute reference':'外部争议编号','Opening a dispute suspends a non-admin customer and revokes sessions. Closing it does not automatically reactivate the account or refund payment.':'开启争议会停用普通用户并退出其登录会话。关闭争议不会自动恢复账号或退还资金。','Management change saved':'管理操作已保存',
 'Account suspended. Contact the operator.':'账号已停用，请联系管理员。','Record changed. Reload and try again.':'记录已被修改，请刷新后重试。','Invalid account status':'账号状态无效','Cannot revoke your own session here':'不能在此退出自己的当前会话','Administrator accounts cannot be suspended':'不能停用管理员账号','Official character not found':'找不到官方角色','Invalid character fields':'角色字段无效','Invalid plan ID':'套餐标识无效','Plan ID already exists':'套餐标识已存在','Plan not found':'套餐不存在','Invalid plan fields':'套餐字段无效','Token packs require tokens':'代币包的代币数量必须大于零','Order is not pending':'订单不是待支付状态','Refund already recorded':'退款已记录，凭证不一致','Only paid orders can be refunded':'仅已支付订单可以登记退款','Confirm the refund was completed externally':'请确认已在外部完成退款','Refund reference already used':'退款凭证已用于其他订单','Insufficient tokens to reverse this order. Resolve the balance first.':'余额不足以冲回本订单代币，请先处理余额。','Invalid dispute status':'争议状态无效','Plan changed. Reload pricing and try again.':'套餐价格或权益已更新，请刷新套餐页面后重试。','Refund reversal':'退款代币冲回','Token purchase':'购买代币',
 'user.updated':'更新用户','user.sessions-revoked':'退出用户会话','character.updated':'更新官方角色','character.created':'创建官方角色','plan.updated':'更新套餐定价','order.note':'更新订单备注','order.cancel':'取消订单','order.refund':'记录外部退款','order.dispute':'更新订单争议',
 'Trial usage':'免费次数使用量','Text chat uses your free trial or membership, not your token balance.':'文字聊天使用免费试用次数或会员权益，不扣除代币余额。',
 'Payments are not configured.':'支付服务尚未配置。','Payments are not configured. Free chat is available; paid subscriptions are not yet on sale.':'支付服务尚未配置，可以免费试聊，付费订阅暂未开放购买。','Payment unavailable':'暂未开放支付','✓ Unlimited member text chat':'✓ 会员文字聊天不限量',
 'Chat operations':'聊天运营配置','AI provider configured':'模型服务已配置','AI provider not configured':'模型服务尚未配置',
 'Enable companion chat':'启用普通陪伴聊天','Enable streaming':'启用流式回复','Enable long-term memory':'启用长期记忆','Enable free message limit':'启用免费消息限制',
 'Free lifetime messages':'每个账号累计免费回复数','Chat model':'聊天模型','Maximum output tokens':'回复最大 Token 数','Recent context messages':'近期上下文消息数','Companion instructions':'陪伴风格指令',
 'Only completed free replies count. Failures release the reservation. Active members have unlimited text chat. Changes apply to new requests.':'仅成功完成的免费回复计入次数，失败释放预留额度。有效会员不限文字消息，配置修改对新请求生效。',
 'Save operations settings':'保存运营配置','Operations settings saved':'运营配置已保存','Successful replies':'成功回复','Failed replies':'失败回复','Pending replies':'生成中','Users with memory':'已保存记忆的用户','Input tokens':'输入 Token','Output tokens':'输出 Token',
 'Long-term memory':'长期记忆','Remember useful details across characters and conversations. Review, edit or clear them here. Disabling memory stops learning and recall.':'跨角色和会话记住有用信息。你可以在此查看、修改或清空。关闭后将停止学习和读取记忆。',
 'Memory is disabled by the operator.':'管理员已关闭长期记忆功能。','Remember me across conversations':'允许跨会话记住我','Remembered details':'已记住的信息','Save memory':'保存记忆','Clear memory':'清空记忆','Memory saved':'记忆已保存',
 'Invalid configuration':'配置参数无效','Invalid model name':'模型名称无效','Configuration changed. Reload and try again.':'配置已被其他操作更新，请刷新后重试。','Invalid memory':'记忆内容无效','Memory changed. Reload and try again.':'记忆已更新，请刷新后重试。',
 'Companion chat is disabled by the operator.':'管理员已暂停陪伴聊天。','Companion chat is currently unavailable.':'陪伴聊天暂时不可用。','Unlimited text chat':'文字聊天不限量',
 'Free message limit reached. Subscribe to continue.':'免费回复次数已用完，订阅后可继续聊天。','Free trial completed':'免费试聊已结束','You have used your free replies. Subscribe for unlimited text chat. Unpaid orders do not unlock access.':'你的免费回复次数已用完。订阅后可不限量文字聊天，未支付订单不会解锁权益。','View subscription plans':'查看订阅套餐',
 'AI replies use OpenAI. Recent messages, character details and enabled memory are sent to OpenAI. Successful free replies count toward your trial; members have unlimited text chat.':'AI 回复由 OpenAI 提供，近期消息、角色资料和已启用的记忆会发送至 OpenAI。成功的免费回复计入试用次数，会员不限文字消息。',
 'AI stream interrupted. Your message was saved; free quota was not consumed.':'AI 回复中断，消息已保存，未消耗免费次数。','AI returned an incomplete response. Your message was saved.':'AI 回复不完整，消息已保存。','AI service interrupted. Please retry.':'AI 服务中断，请重试。',
 'Reply saved, but memory could not be updated.':'回复已保存，但本次记忆更新失败。','Connection interrupted. Reload the conversation to check saved messages.':'连接中断，请刷新会话查看已保存的消息。','This message cannot be retried':'此消息不可重试','Retry reply':'重试回复','non-renewing':'已关闭续订',
 'configuration.updated':'更新运营配置','memory.updated':'更新个人记忆','ai.reply':'AI 回复成功','ai.reply.failed':'AI 回复失败',
 'Non-commercial preview · AI chat enabled':'非商用预览 · AI 聊天已启用',
 'Independent non-commercial replica · AI chat enabled':'独立非商用复刻 · AI 聊天已启用',
 'AI chat is enabled. Messages and replies are saved.':'AI 聊天已启用，消息与回复都会保存。',
 'AI text replies are enabled. Image, voice and video generation are not connected.':'AI 文字回复已启用，图片、语音和视频生成尚未接入。',
 'AI replies use OpenAI. Recent messages and character details are sent to OpenAI; messages and replies are saved locally. Test mode does not deduct app tokens.':'AI 回复由 OpenAI 提供。近期消息和角色资料会发送至 OpenAI，消息与回复保存在本地。测试模式不扣站内额度。',
 'AI chat uses OpenAI. Recent conversation messages and character metadata are sent to OpenAI to generate replies. API response storage is disabled. Local messages and replies remain in SQLite. Image, voice and video generation are not connected.':'AI 聊天使用 OpenAI，近期消息和角色资料会发送至 OpenAI 生成回复。请求已关闭 API 响应存储，本地消息和回复保存在 SQLite 中。图片、语音与视频生成尚未接入。',
 'Test mode does not deduct app tokens. Provider API usage is billed separately.':'测试模式不扣站内额度，模型服务的 API 用量单独计费。',
 'Generating reply…':'正在生成回复…','Saving…':'正在保存…',
 'AI service connection failed. Your message was saved.':'AI 服务连接失败，你的消息已保存。',
 'AI key is invalid or lacks model access. Your message was saved.':'AI Key 无效或缺少模型权限，你的消息已保存。',
 'AI quota or rate limit reached. Your message was saved.':'AI 服务额度不足或触发限流，你的消息已保存。',
 'AI service is temporarily unavailable. Your message was saved.':'AI 服务暂时不可用，你的消息已保存。',
 'AI returned an invalid response. Your message was saved.':'AI 返回格式异常，你的消息已保存。',
 'AI returned an empty response. Your message was saved.':'AI 返回内容为空，你的消息已保存。',
 'AI reply is still pending':'AI 回复仍在生成，请稍后再试。',
 'Access until':'有效期至', 'Private content available':'可查看专属内容', 'Internal server error':'服务器内部错误，请稍后重试',
 'total ·':'合计 ·',
 'Incorrect email or password':'邮箱或密码不正确',
 'Confirm that you are at least 18':'请确认你已年满 18 岁',
 'Age must be 18–100':'年龄必须在 18 至 100 岁之间',
 'Choose an existing library image':'请选择现有素材库中的图片',
 'Character limit reached':'角色数量已达上限',
 'Invalid gender':'角色性别无效', 'Invalid style':'角色风格无效',
 'Only your own characters can be deleted':'只能删除自己创建的角色',
 'Manual settlement is disabled':'人工结算功能未启用',
 'Idempotency key was used for a different plan':'此请求标识已用于其他套餐',
 'If an account exists, a password reset link will be sent.':'如果账号存在，将发送密码重置链接。',
 'Email recovery is not configured. Contact the deployment operator.':'邮件找回尚未配置，请联系部署管理员。',
 'Email delivery is temporarily unavailable':'邮件服务暂时不可用',
 'Email adapter requires HTTPS':'邮件适配器需要 HTTPS',
 'Order created; no payment has been collected. Credits are allocated only after verified settlement.':'订单已创建，未收取款项。核实结算后才会发放额度。',
 'Message saved. AI responses are not connected.':'消息已保存，AI 回复尚未接入。',
 'Only pending orders can be cancelled':'只能取消待支付订单',
 'Order cancelled':'订单已取消','Order not found':'找不到订单','Unknown plan':'未知套餐',
 'This MVP does not initiate recurring charges. Existing access continues until expiry.':'此 MVP 不发起自动扣款，现有使用权限将持续到有效期结束。',
 'Invalid JSON':'JSON 格式无效','JSON object required':'请求必须为 JSON 对象','JSON required':'请求需要 JSON 格式',
 'Endpoint not found':'接口不存在','Method not allowed':'请求方法不被允许',
 'File not found':'文件不存在','Invalid path':'路径无效','Invalid byte range':'文件范围无效',
 'Billing webhook not configured':'支付回调未配置','Expired webhook':'支付回调已过期',
 'Invalid webhook signature':'支付回调签名无效','Unsupported event':'不支持的事件',
 'Payment amount or currency mismatch':'支付金额或币种不匹配',
 'Checkout configuration requires HTTPS':'支付配置需要 HTTPS',
 'Start the MVP server with':'启动 MVP 服务，请运行',
 ', or open the separate offline static version.':'，或打开独立的离线静态版本。'
});
let language='zh-CN';
try { language=localStorage.getItem('candy-language')||'zh-CN'; } catch {}
if(!['zh-CN','en'].includes(language))language='zh-CN';
function t(text) {
 if(language==='en')return text;
 const key=text.trim();
 let translated=zh[key];
 if(!translated){
  const rules=[[/^(\d+) years$/,(_,n)=>`${n} 岁`],[/^Banner (\d+)$/,(_,n)=>`横幅 ${n}`],[/^Choose (.+) portrait$/,(_,n)=>`选择 ${n} 的头像`],[/^(Realistic|Anime) character style$/,(_,s)=>`${zh[s]}角色风格`],[/^(\d+) public preview videos · assets served locally$/,(_,n)=>`${n} 个公开预览视频 · 本地素材`],[/^Access until (.+)$/,(_,d)=>`有效期至 ${d}`],[/^(monthly|quarterly|annual) · (active|cancelled)$/,(_,p,s)=>`${zh[p]} · ${zh[s]}`],[/^([^·]+) total · (\d+) tokens$/,(_,v,n)=>`合计 ${v} · ${n} 额度`],[/^(12 Months|3 Months|1 Month) · (.+) total · (\d+) tokens$/,(_,p,v,n)=>`${zh[p]} · 合计 ${v} · ${n} 额度`]];
  rules.unshift([/^(\d+) records · (\d+) \/ (\d+)$/,(_,n,p,t)=>`${n} 条记录 · 第 ${p} / ${t} 页`],[/^(\d+) (month|week) · (\d+) tokens$/,(_,n,u,t)=>`${n} ${zh[u]} · ${t} 代币`],[/^(\d+) \/ (\d+) free replies remaining$/,(_,a,b)=>`剩余 ${a} / ${b} 次免费回复`],[/^Character preview (\d+)$/,(_,n)=>`角色预览 ${n}`],[/^total · (\d+) tokens$/,(_,n)=>`合计 · ${n} 额度`],[/^· (\d+) tokens$/,(_,n)=>`· ${n} 额度`],[/^(12 Months|3 Months|1 Month) ·$/,(_,p)=>`${zh[p]} ·`]);
  for(const [re,fn] of rules)if(re.test(key)){translated=key.replace(re,fn);break;}
 }
 return translated?text.replace(key,translated):text;
}
const originals=new WeakMap(), attributes=new WeakMap();
function apply(root=document.body){
 if(!root)return;
 const blocked=el=>el?.closest('script,style,textarea,[translate="no"]');
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let node;while((node=walker.nextNode())){
  if(blocked(node.parentElement))continue;
  const last=originals.get(node),source=last&&node.nodeValue===last.output?last.source:node.nodeValue;
  // Option values must stay canonical even when their displayed labels change.
  if(node.parentElement?.tagName==='OPTION'&&!node.parentElement.hasAttribute('value'))node.parentElement.value=node.parentElement.textContent;
  const output=t(source);originals.set(node,{source,output});if(node.nodeValue!==output)node.nodeValue=output;
 }
 for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]')){
  if(blocked(el))continue;
  const saved=attributes.get(el)||{};
  for(const attr of ['placeholder','aria-label','title'])if(el.hasAttribute(attr)){
   const value=el.getAttribute(attr),old=saved[attr],source=old&&value===old.output?old.source:value,output=t(source);
   saved[attr]={source,output};if(value!==output)el.setAttribute(attr,output);
  }
  attributes.set(el,saved);
 }
 for(const el of root.querySelectorAll('[data-locale-date]')){
  const d=new Date(el.dataset.localeDate);el.textContent=el.dataset.dateKind==='time'?d.toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit'}):el.dataset.dateKind==='datetime'?d.toLocaleString(language):d.toLocaleDateString(language);
 }
 for(const el of root.querySelectorAll('[data-locale-money]'))el.textContent=new Intl.NumberFormat(language,{style:'currency',currency:el.dataset.currency||'USD'}).format(Number(el.dataset.localeMoney)/(10**new Intl.NumberFormat('en',{style:'currency',currency:el.dataset.currency||'USD'}).resolvedOptions().maximumFractionDigits));
 document.documentElement.lang=language;
 document.title=document.body.classList.contains('admin-app')?(language==='zh-CN'?'AM08 — 运营后台':'AM08 — Administration'):(language==='zh-CN'?'Candy AI — AI 伙伴':'Candy AI — Companion');
 const select=document.getElementById('language-select');if(select)select.value=language;
}
const observer=new MutationObserver(()=>{observer.disconnect();apply();observe()});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true})}
window.CandyI18n={t,apply,get locale(){return language},setLanguage(value){if(!['zh-CN','en'].includes(value))return;language=value;try{localStorage.setItem('candy-language',value)}catch{}observer.disconnect();apply();observe()}};
document.addEventListener('change',e=>{if(e.target.id==='language-select')window.CandyI18n.setLanguage(e.target.value)});
apply();observe();
})();
