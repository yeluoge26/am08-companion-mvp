"""Code-only rolling release; preserve assets, environment, TLS and live database."""
from pathlib import Path
import os, time, tarfile, paramiko, shlex, hashlib, json, subprocess, io

root = Path(__file__).resolve().parents[1]
release = '/opt/candy-mvp/releases/' + time.strftime('%Y%m%d-%H%M%S')
archive = root / 'data' / 'code-update.tar.gz'
files=list(root.glob('*.mjs')) + [root/'package.json',root/'scripts/operator.mjs',root/'scripts/health-check.mjs',root/'scripts/apply-character-prompts.mjs',root/'character-personas.json'] + [p for p in (root/'public').iterdir() if p.is_file()]
manifest={'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'files':{p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
with tarfile.open(archive, 'w:gz') as tar:
    for p in files: tar.add(p, arcname=p.relative_to(root))
    payload=json.dumps(manifest).encode(); info=tarfile.TarInfo('release.json'); info.size=len(payload); tar.addfile(info,io.BytesIO(payload))
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('139.180.222.17', username='root', password=os.environ['DEPLOY_SSH_PASSWORD'], look_for_keys=False, allow_agent=False, timeout=20)
def run(command):
    _, out, err = ssh.exec_command(command, timeout=180)
    output = out.read().decode(); error = err.read().decode()
    if out.channel.recv_exit_status(): raise RuntimeError(output + error)
    return output.strip()
try:
    old = run('readlink -f /opt/candy-mvp/current')
    print(run('systemctl start candy-mvp-backup.service && systemctl is-active candy-mvp'))
    run('mkdir '+shlex.quote(release)+' && cp -a /opt/candy-mvp/current/. '+shlex.quote(release)+'/')
    with ssh.open_sftp() as s: s.put(str(archive), '/tmp/candy-code-update.tar.gz')
    run('tar -xzf /tmp/candy-code-update.tar.gz -C '+shlex.quote(release)+' && cd '+shlex.quote(release)+' && /usr/local/bin/node --check server.mjs && /usr/local/bin/node --check management.mjs && /usr/local/bin/node --check public/admin-ui.js')
    try:
        run('ln -sfn '+shlex.quote(release)+' /opt/candy-mvp/current && systemctl restart candy-mvp')
        time.sleep(2)
        print(run('systemctl is-active candy-mvp && curl -fsS http://127.0.0.1:4180/api/health'))
    except Exception:
        run('ln -sfn '+shlex.quote(old)+' /opt/candy-mvp/current && systemctl restart candy-mvp')
        raise
    print('Deployed:', release, '| Previous:', old, '| Uploaded bytes:', archive.stat().st_size)
finally:
    ssh.close()
