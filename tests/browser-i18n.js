// Run this function with Playwright's browser_run_code_unsafe filename option.
// Uses an isolated browser context; does not mutate accounts or the database.
async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}});
 const p=await context.newPage(), errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const check=(value,message)=>{if(!value)throw Error(message)};
 try {
  await p.goto('http://127.0.0.1:4180/#register');
  await p.getByRole('heading',{name:'创建账号'}).waitFor();
  await p.locator('[name=name]').fill('Home');
  await p.locator('[name=email]').fill('language@example.test');
  await p.locator('#language-select').selectOption('en');
  await p.getByRole('heading',{name:'Create your account'}).waitFor();
  check(await p.locator('[name=name]').inputValue()==='Home','Language switch lost form input');
  await p.reload();
  await p.getByRole('heading',{name:'Create your account'}).waitFor();
  await p.locator('#language-select').selectOption('zh-CN');
  await p.goto('http://127.0.0.1:4180/#create');
  await p.locator('[data-action=wizard-next]').click();
  await p.locator('[data-action=wizard-next]').click();
  await p.locator('#draft-personality').selectOption({label:'沉稳'});
  check(await p.locator('#draft-personality').inputValue()==='Calm','Translated option changed API enum');
  await p.locator('#draft-name').fill('Home');
  await p.locator('[data-action=wizard-next]').click();
  check(await p.locator('.profile-details h2').innerText()==='Home','User name was translated');
  await p.goto('http://127.0.0.1:4180/#premium');
  await p.getByRole('button',{name:'立即开始'}).first().waitFor();
  const zh=await p.locator('[data-locale-money]').first().innerText();
  await p.locator('#language-select').selectOption('en');
  const en=await p.locator('[data-locale-money]').first().innerText();
  check(zh!==en,'Currency did not follow locale');
  check(await p.locator('#language-select').isVisible(),'Mobile language control missing');
  check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile horizontal overflow');
  check(errors.length===0,errors.join('\n'));
  return {passed:true,checks:['Chinese default','English persistence','Draft preservation','Canonical enum values','User content protection','Currency locale','Mobile layout','No script errors']};
 } finally {await context.close()}
}
