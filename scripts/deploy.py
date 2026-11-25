"""Explicit deployment to the user-authorized host. SSH password is environment-only."""
from pathlib import Path
import os, sys, json, tarfile, secrets, time, shlex
import paramiko

ROOT=Path(__file__).resolve().parents[1]
HOST='139.180.222.17'
c=paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST,username='root',password=os.environ['DEPLOY_SSH_PASSWORD'],timeout=20,look_for_keys=False,allow_agent=False)
def run(command):
    _,stdout,stderr=c.exec_command(command,timeout=900)
    channel=stdout.channel
    while not channel.exit_status_ready() or channel.recv_ready() or channel.recv_stderr_ready():
        if channel.recv_ready(): print(channel.recv(32768).decode(errors='replace'),end='',flush=True)
        if channel.recv_stderr_ready(): print(channel.recv_stderr(32768).decode(errors='replace'),end='',flush=True)
        time.sleep(.1)
    code=channel.recv_exit_status()
    if code: raise RuntimeError('Remote command failed with exit code '+str(code))
def put_text(path,text,mode=0o644):
    with c.open_sftp() as s:
        with s.file(path,'w') as f:f.write(text)
        s.chmod(path,mode)

action=sys.argv[1]
try:
 if action=='bootstrap':
    run('export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq nginx certbot python3-certbot-nginx ca-certificates xz-utils curl nodejs')
    run("node --version; node -e \"if(Number(process.versions.node.split('.')[0])<24)process.exit(1);require('node:sqlite')\"; id candy-mvp >/dev/null 2>&1 || useradd --system --home /var/lib/candy-mvp --shell /usr/sbin/nologin candy-mvp; install -d -o candy-mvp -g candy-mvp /var/lib/candy-mvp; install -d /opt/candy-mvp/releases /var/www/am08-acme")
 elif action=='diagnose':
    run("systemctl is-active nginx; ss -lntp; ufw status verbose; curl -I --max-time 10 http://127.0.0.1; ls -l /etc/nginx/sites-enabled; iptables -S; curl -I --max-time 25 http://am08.one || true")
 elif action=='acme':
    run('ufw allow 80/tcp && ufw allow 443/tcp && certbot certonly --webroot -w /var/www/html -d am08.one --non-interactive --agree-tos --register-unsafely-without-email')
 elif action=='challenge-probe':
    run("mkdir -p /var/www/html/.well-known/acme-challenge; printf am08-acme-ready > /var/www/html/.well-known/acme-challenge/probe; curl -fsS --max-time 20 http://am08.one/.well-known/acme-challenge/probe; tail -n 8 /var/log/nginx/access.log")
 elif action=='node':
    run('''python3 - <<'PY'
import urllib.request,re,hashlib,tarfile,pathlib
base='https://nodejs.org/dist/latest-v24.x/'
sums=urllib.request.urlopen(base+'SHASUMS256.txt',timeout=30).read().decode()
digest,name=re.search(r'^([0-9a-f]{64})  (node-v24[^ ]+-linux-x64.tar.xz)$',sums,re.M).groups()
data=urllib.request.urlopen(base+name,timeout=120).read()
assert hashlib.sha256(data).hexdigest()==digest
archive=pathlib.Path('/tmp')/name;archive.write_bytes(data)
with tarfile.open(archive) as t:t.extractall('/opt',filter='data')
link=pathlib.Path('/usr/local/bin/node')
if link.is_symlink():link.unlink()
link.symlink_to(pathlib.Path('/opt')/name.removesuffix('.tar.xz')/'bin/node')
print('Installed official Node.js with verified SHA-256:',name)
PY
/usr/local/bin/node --version''')
 elif action=='upload':
    release=time.strftime('%Y%m%d-%H%M%S');archive=ROOT/'data'/'deploy.tar.gz'
    with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
        for name in ['public','server.mjs','openai.mjs','ai-provider.mjs','operations.mjs','chat-handler.mjs','package.json','scripts/operator.mjs']:
            tar.add(ROOT/name,arcname=name)
    remote='/opt/candy-mvp/releases/'+release
    run('mkdir -p '+shlex.quote(remote))
    last=[0]
    def progress(sent,total):
        if sent-last[0]>=32*1024*1024 or sent==total:print(f'Uploaded {sent//1048576}/{total//1048576} MiB',flush=True);last[0]=sent
    with c.open_sftp() as s:s.put(str(archive),remote+'/app.tar.gz',callback=progress)
    run(f'tar -xzf {remote}/app.tar.gz -C {remote} && rm {remote}/app.tar.gz && ln -sfn {remote} /opt/candy-mvp/current')
    print('Release '+release,flush=True)
 elif action=='configure':
    local={}
    for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);local[k]=v
    access={'url':'https://am08.one','email':'admin@am08.one','password':secrets.token_urlsafe(22)}
    access_file=ROOT/'data'/'deployment-access.json'
    if access_file.exists():access=json.loads(access_file.read_text(encoding='utf-8'))
    else:access_file.write_text(json.dumps(access,ensure_ascii=False,indent=2),encoding='utf-8')
    env={'HOST':'127.0.0.1','PORT':'4180','NODE_ENV':'production','PUBLIC_ORIGIN':'https://am08.one','DATA_DIR':'/var/lib/candy-mvp','ALLOW_MANUAL_SETTLEMENT':'false','OPENAI_API_KEY':local['OPENAI_API_KEY'],'OPENAI_MODEL':local.get('OPENAI_MODEL','gpt-4.1-mini'),'ADMIN_EMAIL':access['email'],'ADMIN_PASSWORD':access['password']}
    put_text('/etc/candy-mvp.env','\n'.join(f'{k}={v}' for k,v in env.items())+'\n',0o600)
    put_text('/etc/systemd/system/candy-mvp.service','''[Unit]
Description=AM08 Companion MVP
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=candy-mvp
Group=candy-mvp
WorkingDirectory=/opt/candy-mvp/current
EnvironmentFile=/etc/candy-mvp.env
ExecStart=/usr/local/bin/node server.mjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/candy-mvp
[Install]
WantedBy=multi-user.target
''')
    put_text('/etc/nginx/sites-available/am08.one','''server {
 listen 80;
 listen [::]:80;
 server_name am08.one;
 client_max_body_size 128k;
 location /.well-known/acme-challenge/ { root /var/www/html; }
 location / {
  proxy_pass http://127.0.0.1:4180;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 180s;
 }
}
''')
    run('ln -sfn /etc/nginx/sites-available/am08.one /etc/nginx/sites-enabled/am08.one; if [ -L /etc/nginx/sites-enabled/default ]; then unlink /etc/nginx/sites-enabled/default; fi; systemctl daemon-reload && systemctl enable --now candy-mvp && nginx -t && systemctl enable --now nginx && systemctl reload nginx')
    run("sleep 2; curl -fsS http://127.0.0.1:4180/api/health; systemctl is-active candy-mvp nginx")
 elif action=='tls':
    run('certbot --nginx -d am08.one --non-interactive --agree-tos --register-unsafely-without-email --redirect')
    run('nginx -t && systemctl reload nginx; systemctl is-active candy-mvp nginx; curl -fsS https://am08.one/api/health')
 elif action=='restart':
    run('systemctl restart candy-mvp && sleep 2 && systemctl is-active candy-mvp && curl -fsS http://127.0.0.1:4180/api/health')
 elif action=='backup':
    put_text('/etc/systemd/system/candy-mvp-backup.service','''[Unit]
Description=AM08 SQLite backup
[Service]
Type=oneshot
User=candy-mvp
Group=candy-mvp
WorkingDirectory=/opt/candy-mvp/current
Environment=DATA_DIR=/var/lib/candy-mvp
ExecStart=/usr/local/bin/node scripts/operator.mjs backup
UMask=0077
''')
    put_text('/etc/systemd/system/candy-mvp-backup.timer','''[Unit]
Description=Daily AM08 database backup
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
''')
    run('systemctl daemon-reload && systemctl enable --now candy-mvp-backup.timer && systemctl start candy-mvp-backup.service && systemctl is-enabled candy-mvp certbot.timer candy-mvp-backup.timer && stat -c "%a %U %n" /etc/candy-mvp.env /var/lib/candy-mvp/app.sqlite && curl -fsS https://am08.one/api/health')
 else:raise ValueError('Unknown deployment action')
finally:c.close()
