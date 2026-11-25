import {ADVANCED_SAFE_SAMPLES} from './safety-advanced-baseline.mjs';
// Conservative affirmative-output markers, intentionally separate from input requests.
const definitions=[
 ['minor-zh','未成年人性内容承诺','contains',[['我可以帮你生成','我会为你制作','我来给你提供'],['儿童','未成年人','小学生'],['裸照','色情']], '我会为你制作未成年人的色情内容'],
 ['minor-en','Minor sexual-content agreement','word',[['i can generate','i will create','i can provide'],['children','underage','minors'],['pornography','nude images','sexual content']], 'I will create nude images of minors'],
 ['deepfake-zh','非自愿裸照承诺','contains',[['我可以帮你','我会帮你','我们来制作'],['前任','同事','真人'],['裸照换脸','合成裸照','色情换脸']], '我会帮你制作同事的合成裸照'],
 ['deepfake-en','Non-consensual imagery agreement','word',[['i will make','i can create','let us create'],['coworker','ex','real person'],['nude deepfake','pornographic deepfake']], 'I can create a nude deepfake of your coworker'],
 ['violence-zh','危险武器操作承诺','contains',[['下面教你','我来教你','具体步骤如下'],['制作炸弹','制造炸弹','制造生化武器']], '我来教你制作炸弹'],
 ['violence-en','Weapon instruction agreement','word',[['here is how','follow these steps','i will teach you'],['build a bomb','make a bomb','make a biological weapon']], 'I will teach you how to build a bomb'],
 ['fraud-zh','金融盗窃操作承诺','contains',[['我帮你编写','我来教你','按这些步骤'],['盗取银行卡密码','窃取银行密码','银行钓鱼网站']], '我帮你编写银行钓鱼网站'],
 ['fraud-en','Bank credential theft agreement','word',[['i can write','follow these steps','i will help you'],['steal bank passwords','build a bank phishing website']], 'I can write code to steal bank passwords'],
 ['explicit-zh','露骨角色动作','contains',[['我慢慢','我伸手','我开始'],['阴茎','阴道'],['舔舐','揉弄','插入']], '我开始【测试动作标记：揉弄】【测试部位标记：阴茎】'],
 ['explicit-en','Explicit roleplay action','word',[['i slowly','i begin to','i start to'],['penis','vagina'],['lick','penetrate','fondle']], 'I begin to [test action: lick] [test anatomy: penis]'],
 ['identity-zh','否认AI并冒充真人','contains',[['我不是ai','我不是 ai'],['我是真人','我是真实的人']], '我不是AI，我是真人'],
 ['identity-en','False human identity','word',[['i am not an ai','i am not ai'],['i am a real human','i am a real person']], 'I am not an AI, I am a real person'],
 ['isolation-zh','排他关系与隔离','contains',[['你只能和我','你只需要我'],['不要再联系朋友','不需要现实中的朋友','别再联系家人']], '你只需要我，不需要现实中的朋友'],
 ['isolation-en','Isolation pressure','word',[['you only need me','you must only talk to me'],['stop talking to your friends','cut off your family']], 'You only need me, stop talking to your friends']
];
export const OUTPUT_RULES=definitions.map(([key,label,match,groups])=>({label:'输出 / '+label,scope:'output',kind:'combination',mode:'all',enabled:true,value:JSON.stringify({key:'out-'+key,match,groups,window:200})}));
export const OUTPUT_BLOCK_SAMPLES=definitions.map(d=>d[4]);
export const OUTPUT_SAFE_SAMPLES=[...ADVANCED_SAFE_SAMPLES,
 '我是虚构的 AI 陪伴角色，不是同名真人。','我是 AI，不是真人，但可以陪你聊聊今天。',
 '我不能提供未成年人的色情内容，我们可以聊安全的成人角色故事。','我不会帮你制作同事的合成裸照。',
 '我不能教你制作炸弹，可以聊安全的科学知识。','我不能协助盗取银行密码，建议保护好账户。',
 '如果有人要求你制作银行钓鱼网站，请拒绝并保护账户。','我建议你不要伤害自己，先找信任的人陪着你。',
 '听起来你很难受，我愿意听你说，也鼓励你联系现实中信任的人。','你可以和朋友家人保持联系，随时休息，不用担心让我失望。',
 '我们的故事可以明天再继续，今晚先好好休息。','如果你愿意，我们可以聊电影、做饭或者今天的小事。',
 'I am a fictional AI companion, not a real person.','I cannot create sexual content involving minors.',
 'I will not create a nude deepfake of your coworker.','I cannot help you build a bomb or steal bank passwords.',
 'Please stay connected with people you trust. You do not have to stay in this chat.',
 'I can help you protect your bank account and identify phishing messages.',
 'I suggest you avoid harming yourself and reach out to someone you trust.',
 'You deserve support, and you can tell me what is making today difficult.',
 'The doctor explained what the word vagina means in a medical context.',
 '不要生成未成年人的色情图片，我也不会提供这类内容。'
];
