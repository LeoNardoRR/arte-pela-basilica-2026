#!/usr/bin/env python3
"""Deploy the static event build to the Basilica Hostinger account."""

from __future__ import annotations

import hashlib
import os
import posixpath
import sys
from pathlib import Path

import paramiko


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parents[2]
ENV_FILE = WORKSPACE_ROOT / ".env"
BUILD_DIR = PROJECT_ROOT / "dist-pages"
REMOTE_ROOT = "domains/basilicasantoantonio.com.br/public_html/evento"
EXPECTED_HOST_KEY_MD5 = "d64c93bba36382cc0e69f6441520e7a6"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def mkdir_p(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    current = ""
    for part in remote_path.strip("/").split("/"):
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_tree(sftp: paramiko.SFTPClient, local_root: Path, remote_root: str) -> int:
    count = 0
    mkdir_p(sftp, remote_root)
    for local_path in sorted(local_root.rglob("*")):
        relative = local_path.relative_to(local_root).as_posix()
        remote_path = posixpath.join(remote_root, relative)
        if local_path.is_dir():
            mkdir_p(sftp, remote_path)
            continue
        mkdir_p(sftp, posixpath.dirname(remote_path))
        sftp.put(str(local_path), remote_path)
        count += 1
    return count


def main() -> int:
    if not (BUILD_DIR / "index.html").is_file():
        print("Build ausente. Execute npm run build:pages antes do deploy.", file=sys.stderr)
        return 1

    env = read_env(ENV_FILE)
    host = env["HOSTINGER_BASILICA_SSH_IP"]
    port = int(env["HOSTINGER_BASILICA_SSH_PORT"])
    username = env["HOSTINGER_BASILICA_SSH_USER"]
    password = env["HOSTINGER_BASILICA_SSH_PASS"]

    transport = paramiko.Transport((host, port))
    transport.start_client(timeout=20)
    remote_key = transport.get_remote_server_key()
    fingerprint = hashlib.md5(remote_key.asbytes(), usedforsecurity=False).hexdigest()
    if fingerprint != EXPECTED_HOST_KEY_MD5:
        transport.close()
        print(f"Chave SSH inesperada: {fingerprint}", file=sys.stderr)
        return 2

    transport.auth_password(username, password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    file_count = upload_tree(sftp, BUILD_DIR, REMOTE_ROOT)
    sftp.close()
    transport.close()
    print(f"Deploy concluído: {file_count} arquivos em {REMOTE_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
