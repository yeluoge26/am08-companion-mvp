"""Fetch an encrypted off-host snapshot and restore-test it in an isolated local app.
Requires paramiko, cryptography, requests and Node 24. Never sends email/model calls.
Encryption key and snapshot remain in gitignored data/. This is an operator-run job.
"""
from pathlib import Path
import os,io,json,zipfile,time,subprocess,hashlib,sqlite3,shutil,socket
import paramiko,requests
from cryptography.fernet import Fernet
root=Path(__file__).resolve().parents[1];private=root/'data';private.mkdir(exist_ok=True)
c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('139.180.222.17',username='root',password=os.environ['DEPLOY_SSH_PASSWORD'],look_for_keys=False,allow_agent=False,timeout=20)
def remote(command):
 _,out,err=c.exec_command(command,timeout=120);text=out.read().decode();error=err.read().decode()
 if out.channel.recv_exit_status():raise RuntimeError(error)
 return text.strip()
try:
 remote('systemctl start candy-mvp-backup.service')
 with c.open_sftp() as s:
  names=[n for n in s.listdir('/var/lib/candy-mvp') if n.startswith('backup-') and n.endswith('.sqlite') and n[7:-7].isdigit()]
  name=max(names,key=lambda n:int(n[7:-7]));items={}
  for source,target in [(name,'app.sqlite'),(name+'.mfa.key','staff-mfa.key')]:
   with s.open('/var/lib/candy-mvp/'+source,'rb') as f:items[target]=f.read()
  with s.open('/opt/candy-mvp/current/release.json','rb') as f:items['release.json']=f.read()
finally:c.close()
manifest={k:hashlib.sha256(v).hexdigest() for k,v in items.items()};buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
 for name,value in items.items():z.writestr(name,value)
 z.writestr('manifest.json',json.dumps(manifest))
keyfile=private/'disaster-recovery.key'
if not keyfile.exists():keyfile.write_bytes(Fernet.generate_key());keyfile.chmod(0o600)
fernet=Fernet(keyfile.read_bytes());archive=private/('offsite-'+time.strftime('%Y%m%d-%H%M%S')+'.enc');archive.write_bytes(fernet.encrypt(buffer.getvalue()));archive.chmod(0o600)
drill=private/('restore-drill-'+str(time.time_ns()));drill.mkdir(mode=0o700)
process=None
try:
 with zipfile.ZipFile(io.BytesIO(fernet.decrypt(archive.read_bytes()))) as z:
  for name,digest in manifest.items():
   value=z.read(name);assert hashlib.sha256(value).hexdigest()==digest;(drill/name).write_bytes(value)
 db=sqlite3.connect(drill/'app.sqlite');assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';assert not db.execute('PRAGMA foreign_key_check').fetchall()
 counts={table:db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ['users','characters','messages','feedback','staff_mfa']};db.close()
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 env={**os.environ,'DATA_DIR':str(drill),'PORT':str(port),'HOST':'127.0.0.1','PUBLIC_ORIGIN':f'http://127.0.0.1:{port}','NODE_ENV':'development','OPENAI_API_KEY':'','ADMIN_EMAIL':'','ADMIN_PASSWORD':'','MAIL_WEBHOOK_URL':'','MAIL_WEBHOOK_TOKEN':''}
 env.pop('DEPLOY_SSH_PASSWORD',None)
 with (drill/'startup.log').open('w') as log:
  process=subprocess.Popen(['node','server.mjs'],cwd=root,env=env,stdout=log,stderr=log)
  for i in range(100):
   try:
    health=requests.get(f'http://127.0.0.1:{port}/api/health',timeout=1).json()
    if health.get('ok'):break
   except requests.RequestException:pass
   time.sleep(.1)
  else:raise RuntimeError('Restored application did not start')
  assert not health['modelEnabled']
  catalog=requests.get(f'http://127.0.0.1:{port}/api/characters',timeout=10);assert catalog.ok
  assert requests.get(f'http://127.0.0.1:{port}/api/features',timeout=10).ok
 report={'archive':str(archive),'hashesVerified':len(manifest),'integrity':'ok','foreignKeys':0,'restoredAppHealthy':True,'modelCallsDisabled':True,'counts':counts}
 (private/'restore-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
finally:
 if process:process.terminate();process.wait(timeout=15)
 # Only remove this precisely named, newly created private drill directory.
 assert drill.resolve().parent==private.resolve() and drill.name.startswith('restore-drill-')
 shutil.rmtree(drill)
