async(page)=>{
 const base='http://127.0.0.1:4180',suffix=Date.now(),created=[],checks=[];let csrf;
 const assert=(condition,message)=>{if(!condition)throw Error(message)};
 const request=async(route,method='GET',body)=>page.evaluate(async({route,method,body,csrf})=>{const r=await fetch(route,{method,headers:{'Content-Type':'application/json','X-Admin-Context':'1','X-CSRF-Token':csrf||''},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}},{route,method,body,csrf});
 await page.goto(base+'/admin/');await page.waitForSelector('a[href="#admin/staff"]');csrf=(await request('/api/admin/me')).body.csrf;
 try{
 for(const role of ['operations','reviewer','finance','support']){
  await page.locator('a[href="#admin/staff"]').click();await page.locator('[data-action="manage-staff"][data-id=""]').click();const f=page.locator('#manage-form');await f.locator('[name=name]').fill('RBAC browser '+role);await f.locator('[name=email]').fill(`${role}.${suffix}@example.test`);await f.locator('[name=password]').fill('browser-test-password-2026');await f.locator('[name=role]').selectOption(role);await f.locator('[name=reason]').fill('Local browser regression');await f.locator('[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);const rows=(await request('/api/admin/staff')).body.staff;created.push(rows.find(x=>x.email===`${role}.${suffix}@example.test`));assert(created.at(-1),'Staff creation '+role);
 }
 for(const role of ['operations','reviewer','finance','support']){
  const ctx=await page.context().browser().newContext();const p=await ctx.newPage();try{
   await p.goto(base+'/admin/');await p.locator('#admin-login [name=email]').fill(`${role}.${suffix}@example.test`);await p.locator('#admin-login [name=password]').fill('browser-test-password-2026');await p.locator('#admin-login button').click();await p.waitForSelector('.admin-tabs');assert(!await p.locator('a[href="#admin/staff"]').count(),'Hidden staff nav '+role);assert(!await p.locator('a[href="#admin/audit"]').count(),'Hidden audit nav '+role);
   const denied=await p.evaluate(async()=>{const r=await fetch('/api/admin/staff',{headers:{'X-Admin-Context':'1'}});return r.status});assert(denied===403,'API forbidden '+role);
   const expected=role==='reviewer'?'reports':role==='support'?'users':'metrics';assert(p.url().endsWith('#admin/'+expected),'Default landing '+role);
   if(role==='operations'){await p.locator('a[href="#admin/plans"]').click();await p.waitForSelector('a.chip.active[href="#admin/plans"]');assert(!await p.locator('[data-action="manage-plan"]').count(),'No plan editing for operations')}
   if(role==='support'){await p.locator('[data-action="security"]').click();const f=p.locator('#staff-self-password');await f.locator('[name=currentPassword]').fill('browser-test-password-2026');await f.locator('[name=password]').fill('browser-new-password-2026');await f.locator('button').click();await p.waitForSelector('#admin-login');checks.push('Self password change returns to login')}
   checks.push(role+' menu, landing and server denial');
  }finally{await ctx.close()}
 }
 await page.locator('a[href="#admin/audit"]').click();await page.waitForSelector('a.chip.active[href="#admin/audit"]');assert((await page.locator('.admin-workspace').innerText()).includes('403'),'Audit contains denials');checks.push('Audit renders success and denials');return {checks,staffCreated:created.length};
 }finally{for(const u of created){const rows=(await request('/api/admin/staff')).body.staff,current=rows.find(x=>x.id===u.id);const r=await request('/api/admin/staff/'+u.id,'PATCH',{...current,status:'disabled',reason:'Browser regression cleanup'});assert(r.status===200,'Disable test staff')} }
}
