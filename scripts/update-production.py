"""Code-only rolling release; preserve assets, environment, TLS and live database."""
from pathlib import Path
import os, time, tarfile, paramiko, shlex

root = Path(__file__).resolve().parents[1]
release = '/opt/candy-mvp/releases/' + time.strftime('%Y%m%d-%H%M%S')
archive = root / 'data' / 'code-update.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    for p in list(root.glob('*.mjs')) + [root/'package.json', root/'scripts/operator.mjs'] + [p for p in (root/'public').iterdir() if p.is_file()]:
        tar.add(p, arcname=p.relative_to(root))
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
