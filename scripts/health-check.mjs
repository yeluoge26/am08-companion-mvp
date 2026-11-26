// Local monitor: no customer text or secrets in the status file/journal.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const dir=path.resolve(process.env.DATA_DIR||'data'),issues=[];
try{const r=await fetch(process.env.HEALTH_URL||'http://127.0.0.1:4180/api/health',{signal:AbortSignal.timeout(10000)});if(!r.ok||!(await r.json()).ok)issues.push('application_unhealthy')}catch{issues.push('application_unreachable')}
try{const db=new DatabaseSync(path.join(dir,'app.sqlite'),{readOnly:true});db.exec('PRAGMA busy_timeout=5000');if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')issues.push('database_integrity');db.close()}catch{issues.push('database_unavailable')}
const backups=fs.readdirSync(dir).filter(x=>/^backup-\d+\.sqlite$/.test(x)).map(x=>Number(x.match(/\d+/)[0]));
const latest=Math.max(0,...backups);if(Date.now()-latest>36*3600000)issues.push('backup_overdue');
const disk=fs.statfsSync(dir);if(disk.bavail*disk.bsize<1024**3)issues.push('disk_space_below_1GiB');
const result={checked:new Date().toISOString(),ok:!issues.length,issues,latestBackup:latest?new Date(latest).toISOString():null};
const tmp=path.join(dir,'health-status.tmp');fs.writeFileSync(tmp,JSON.stringify(result),{mode:0o600});fs.renameSync(tmp,path.join(dir,'health-status.json'));
console.log(JSON.stringify(result));if(issues.length)process.exitCode=1;
