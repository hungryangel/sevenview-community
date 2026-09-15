# Installation / 설치 안내

[Home / 처음으로](../README.md) · [Usage / 사용 방법](USER_GUIDE.md)

## 1. Requirements / 준비 사항

- Git: [official downloads](https://git-scm.com/downloads).
- Node.js **24 or later**: [official installer](https://nodejs.org/en/download).
- pnpm **11.19.0**, the version pinned in `package.json`.
- A desktop browser with WebAssembly support. Chrome/Edge are recommended;
  low-memory devices and very large photo sets can take longer.
- An internet connection for the initial dependency installation and first model
  loads. There is no API key, account, database or environment file to configure.

Windows: run these commands in PowerShell or Terminal. macOS/Linux: use Terminal.
Install Node using its installer or your normal version manager. Check:

```bash
git --version
node --version
npm --version
```

Node가 `v24`보다 낮으면 먼저 업데이트하세요. 권한 오류가 나면 관리자 권한 명령을
무작정 실행하지 말고 Node 설치 위치나 사용하는 버전 관리자의 설정을 확인하세요.

## 2. Clone and install / 내려받기와 설치

```bash
git clone https://github.com/hungryangel/sevenview-community.git
cd sevenview-community
npm install -g pnpm@11.19.0
pnpm --version
pnpm install --frozen-lockfile
```

The repository includes the model assets and a documented dependency patch.
Do not delete `pnpm-lock.yaml` or `patches/` to work around an installation error.
If Git is unavailable, GitHub's **Code → Download ZIP** is an alternative: extract
the ZIP, open a terminal in the extracted folder, then run the installation commands
starting at `npm install -g pnpm@11.19.0`.

## 3. Run locally / 로컬 실행

```bash
pnpm dev
```

Open the address printed by Vite, normally `http://localhost:5173`.
`/` is the introduction; `/app` is the photo workspace. If the port is already in
use, Vite may select another port—use the address shown in your terminal.
Keep the terminal running while using the app. Press **Ctrl+C** to stop it.

처음에는 [합성 예시 사진](../public/examples) 7개로 테스트하세요. 실제 환자 사진을
사용하기 전에 동의·보관·공유 정책과 출력물을 확인해야 합니다.

## 4. Production build / 운영용 빌드

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm verify:community
pnpm preview --host 127.0.0.1 --port 4173
```

Visit `http://127.0.0.1:4173` and `/app`. `preview` is a local validation server,
**not** a hardened production server. Build output is in `dist/`.
Do not double-click `dist/index.html`; module scripts and local model requests need
HTTP(S). Exported comparison HTML files are different and can be opened directly.

## 5. Static hosting / 서버에 올릴 때

Deploy the complete `dist/` directory to an HTTPS static host:

- Serve it at the domain root. The current `/app` route and asset paths assume `/`;
  a subdirectory installation needs explicit path changes and separate testing.
- Rewrite application navigation such as `/app` to `/index.html`.
- Serve real `/assets/`, `/models/`, `/wasm/`, `/fonts/`, `/brand/` and `/examples/`
  files without rewriting their contents to HTML. Missing assets must not return
  an HTML page with a misleading 200 status.
- Serve WASM with `application/wasm`; retain generated hashed asset filenames.
- Keep scripts/models/fonts on the same origin. Do not add photo upload or
  analytics integrations without separately reviewing privacy requirements.
- Do not publish local `.env`, `.vercel`, patient data, private branches or
  operator notes. Run the release guard against a clean source/build tree.
- Test direct `/app` navigation, refresh, local photo loading, alignment and each
  required export after deployment. A successful build alone does not prove hosting works.

For internal hospital hosting, network access controls, backups and operational
security need a separate deployment review. The Community app does not supply
an ERP, user management system, secure patient archive or compliance certification.

## 6. Troubleshooting / 자주 막히는 부분

| Symptom | Check |
| --- | --- |
| `pnpm` not found | Install the pinned pnpm version, reopen the terminal and check `pnpm --version`. |
| Unsupported engine | Check `node --version`; Node 24+ is required. |
| Frozen lockfile error | Use the pinned pnpm version and an unmodified checkout; retain lockfile and patches. |
| Address does not open | Keep the dev/preview terminal running and use its printed port. |
| Model loading fails | Check `/models/` and `/wasm/` return files, not HTML; reload and try a current desktop browser. |
| Photos remain unassigned | Review framing/occlusion and manually assign the view; do not assume every input is recognizable. |
| Downloads seem missing | Check browser download permissions and Downloads folder; browser settings determine the destination. |
| Refresh at `/app` returns 404 | Configure the static host's navigation fallback. |
| Release guard flags `.vercel` | Validate in a clean checkout without local deployment metadata; do not weaken the guard to hide private files. |

## 7. Updating / 업데이트

Keep your custom work committed or backed up first; do not overwrite local changes.
In an unmodified checkout:

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm verify:community
```

Re-test exports before replacing an existing installation. See
[CONTRIBUTING](../CONTRIBUTING.md), [privacy](PRIVACY.md) and
[paid operational/customization help](http://pf.kakao.com/_JDbbX/chat).
