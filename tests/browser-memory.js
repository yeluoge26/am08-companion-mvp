async (page) => {
 const ctx=await page.context().browser().newContext(),p=await ctx.newPage();
 const base='http://127.0.0.1:4180',password='memory-ui-test-password-2026';let signedUp=false;
 try {
  await p.goto(base+'/#register');await p.locator('[name=name]').fill('Memory regression');await p.locator('[name=email]').fill('memory-'+Date.now()+'@example.test');await p.locator('[name=password]').fill(password);await p.locator('[name=adult]').check();await p.locator('#auth-form button').click();await p.waitForURL('**/#home');signedUp=true;
  const conversations=await p.evaluate(async()=>{const account=await(await fetch('/api/me')).json(),chars=(await(await fetch('/api/characters')).json()).characters;const result=[];for(const c of chars.slice(0,2)){const r=await fetch('/api/conversations',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':account.csrf},body:JSON.stringify({characterId:c.id})});result.push((await r.json()).conversation)}return result});
  await p.goto(base+'/#chat/'+conversations[0].id);await p.locator('#character-memory[data-character="'+conversations[0].character_id+'"]').waitFor();await p.locator('[data-action=character-memory]').click();await p.locator('#memory-form textarea').fill('喜欢乌龙茶\n周末喜欢徒步');await p.locator('#memory-form [type=submit]').click();await p.locator('.memory-fact').nth(1).waitFor();
  if(p.url().includes('?'))throw Error('Memory leaked into form navigation URL');
  await p.locator('[data-action=remove-memory-fact]').first().click();await p.waitForFunction(()=>document.querySelectorAll('.memory-fact').length===1);await p.locator('[data-action=close-modal]').click();
  await p.goto(base+'/#chat/'+conversations[1].id);await p.locator('#character-memory[data-character="'+conversations[1].character_id+'"]').waitFor();await p.locator('[data-action=character-memory]').click();await p.locator('#memory-form[data-character="'+conversations[1].character_id+'"]').waitFor();if(await p.locator('#memory-form textarea').inputValue()!=='')throw Error('Cross-character memory leak');await p.locator('[data-action=close-modal]').click();
  await p.goto(base+'/#chat/'+conversations[0].id);await p.locator('#character-memory[data-character="'+conversations[0].character_id+'"]').waitFor();await p.locator('#character-memory').getByText('周末喜欢徒步',{exact:true}).waitFor();await p.locator('[data-action=character-memory]').click();await p.locator('#memory-form[data-character="'+conversations[0].character_id+'"]').waitFor();await p.locator('#memory-form [name=enabled]').uncheck();await p.locator('#memory-form [type=submit]').click();await p.locator('.memory-paused').waitFor();await p.locator('[data-action=clear-memory]').click();await p.waitForFunction(()=>document.querySelector('#memory-form textarea').value===''&&document.querySelectorAll('.memory-fact').length===0);
  return {saved:true,forgotOne:true,isolated:true,paused:true,cleared:true};
 } finally {
  if(signedUp)await p.evaluate(async password=>{const a=await(await fetch('/api/me')).json();const r=await fetch('/api/me',{method:'DELETE',headers:{'Content-Type':'application/json','X-CSRF-Token':a.csrf},body:JSON.stringify({password,confirm:true})});if(!r.ok)throw Error('Test account cleanup failed')},password);
  await ctx.close();
 }
}
