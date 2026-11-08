# Home Assistant PIP — Installation and configuration

**Enhanced LG webOS fork by [tixelcat](https://github.com/tixelcat), based on the original MIT-licensed work by [ISDaddy](https://github.com/ISDaddy).**

This guide describes the **locally tested TV app v1.0.5 (tixelcat)** and its setup with Home Assistant. Version 1.0.5 retains the working overlay, remote-control recovery and best-effort rooted screensaver wake behavior of v1.0.4. It adds a new app icon and changes the MJPEG first-frame polling interval from 100 ms to 50 ms. This may shave a small amount of time off first-frame detection; actual camera startup time depends mostly on Home Assistant and the camera.

> **Compatibility:** v1.0.5 was tested on one rooted LG webOS TV over IPTV and YouTube, including repeated PIP launches and screensaver wake. Results may vary on other models, webOS versions and protected video apps. Basic PIP may work without root; the privileged screensaver wake-up path requires compatible Homebrew root services.

> **Release:** [v1.0.5-tixelcat](https://github.com/tixelcat/ha-lg-webos-pip/releases/tag/v1.0.5-tixelcat) - installer in Assets.

## 1. Requirements

- An LG webOS TV that supports overlay apps, reachable from Home Assistant.
- Home Assistant with a working `camera.*` entity and the **built-in LG webOS TV** integration already paired with the TV.
- A TV app installation route: **A — Homebrew root SSH** or **B — Developer Mode**.
- A computer with the required SSH/SCP client (route A) or webOS CLI (route B).
- The custom **LG webOS PIP** HA integration is **optional** if you use the verified `webostv.command` action below.

**Installer filename for v1.0.5:** `io.github.tixelcat.lgwebospip_1.0.5_all.ipk`.

> **Important — filename vs app ID:** The package file is named for **tixelcat**, but the app's **internal webOS ID remains `io.github.isdaddy.lgwebospip`** for compatibility with existing installations and HA launches. Do not substitute `tixelcat` into the JSON `id` or HA `payload.id` unless you deliberately migrate the application and every integration that launches it.

## 2A. Install on a rooted LG TV (Homebrew Channel + SSH)

Root access is **not necessary for basic PIP**, but the rooted screensaver wake feature needs a compatible Homebrew service. Check your TV and firmware before rooting: [CanI.RootMy.TV](https://cani.rootmy.tv/), [webOS Homebrew](https://www.webosbrew.org/rooting/) and [RootMy.TV](https://rootmy.tv/). Rooting has risks and may affect support. Do not mix root and Developer Mode setup without checking the Homebrew documentation.

1. Install [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) and verify root SSH access to your TV.
2. Copy the v1.0.5 IPK to your computer, e.g. to `Downloads`. If you keep the package elsewhere, set `$IPK` to its **actual full path**.
3. Find the TV's LAN IP. The address `192.168.1.100` below is an example.
4. Open **Windows PowerShell on the computer** (not the TV's SSH session). Run each command on a separate line:

```powershell
$TV_IP = '192.168.1.100'
$IPK = Join-Path $HOME 'Downloads\io.github.tixelcat.lgwebospip_1.0.5_all.ipk'
# For a local development build, you can instead use:
# $IPK = Join-Path $HOME 'Downloads\HA PIP WEBOS\Releases\1.0.5\io.github.tixelcat.lgwebospip_1.0.5_all.ipk'
if (-not (Test-Path -LiteralPath $IPK)) { throw "IPK not found: $IPK" }
scp "$IPK" "root@${TV_IP}:/tmp/home-assistant-pip.ipk"
if ($LASTEXITCODE -ne 0) { throw 'SCP upload failed' }
ssh "root@${TV_IP}"
```

5. **Only after SSH connects**, run the following on the **TV's Linux shell** (not in PowerShell):

```sh
ls -lh /tmp/home-assistant-pip.ipk
luna-send -n 1 luna://com.webos.applicationManager/closeByAppId '{"id":"io.github.isdaddy.lgwebospip"}'
luna-send -n 1 luna://com.webos.appInstallService/dev/install '{"id":"io.github.isdaddy.lgwebospip","ipkUrl":"/tmp/home-assistant-pip.ipk","subscribe":false}'
```

`app is not running` from the first `luna-send` is harmless when the app is already closed. `returnValue:true` from the install call means the request was accepted; **it does not prove installation has finished**.

6. Once installation has finished, check the installed manifest:

```sh
grep -E '"(id|title|version)"' /media/developer/apps/usr/palm/applications/io.github.isdaddy.lgwebospip/appinfo.json
```

Expected values: internal ID `io.github.isdaddy.lgwebospip`, title `Home Assistant PIP`, version `1.0.5`. If the manifest is still the old version, check installation status before retrying. The install location may differ with firmware.

7. Start the app, or open it from the TV launcher:

```sh
luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"io.github.isdaddy.lgwebospip"}'
exit
```

> **Shell tip:** Run `scp` and `ssh` in Windows PowerShell; run `luna-send` **only after logging into the TV**. If `exit` complains about stopped jobs, inspect `jobs` before terminating a suspended shell job. Do not run broad process-kill commands.

## 2B. Install on a non-root LG TV (Developer Mode)

1. Sign up at [LG webOS TV Developer](https://webostv.developer.lge.com/).
2. Install **Developer Mode** on the LG TV, sign in, enable **Dev Mode Status**, and then enable **Key Server**.
3. On the computer, install Node.js and the webOS CLI:

```powershell
npm.cmd install -g @webos-tools/cli
```

4. Register your TV and retrieve the key. Replace the example IP and use the Developer Mode app's passphrase, **not** your root password:

```powershell
ares-setup-device -a tv -i "host=192.168.1.100" -i "port=9922" -i "username=prisoner" -i "default=true"
ares-novacom --device tv --getkey
```

5. In Windows PowerShell, point `$IPK` at your downloaded v1.0.5 installer, then install it:

```powershell
$IPK = Join-Path $HOME 'Downloads\io.github.tixelcat.lgwebospip_1.0.5_all.ipk'
if (-not (Test-Path -LiteralPath $IPK)) { throw "IPK not found: $IPK" }
ares-install -d tv "$IPK"
ares-install -d tv --list
ares-launch -d tv io.github.isdaddy.lgwebospip
```

Developer Mode sessions expire unless renewed. Follow the current expiry notice in the Developer Mode app. Root-only Homebrew screensaver wake is unavailable in this mode; the non-root fallback is not guaranteed.

## 3. Install the Home Assistant integrations

1. **Required:** Pair your TV using Home Assistant's built-in **LG webOS TV** integration in Settings → Devices & services. Note its `media_player.*` entity ID.
2. **For the recommended direct launch method**, no additional `lg_webos_pip` custom integration is needed. Use the built-in `webostv.command` action in sections 5–6.
3. **Optional:** To use the project's custom integration/UI, add [tixelcat/ha-lg-webos-pip](https://github.com/tixelcat/ha-lg-webos-pip) as a custom HACS Integration (or copy `custom_components/lg_webos_pip/` to HA `/config/custom_components/lg_webos_pip/`), restart HA, and add **LG webOS PIP** via Devices & services.
4. If using the optional custom integration, configure the TV entity, reachable HA URL and access token. Keep the internal app ID `io.github.isdaddy.lgwebospip`.

> **Known behavior:** In one tested setup, repeated `webostv.command` launches worked correctly over IPTV and YouTube while `lg_webos_pip.show` did not behave reliably. For the documented v1.0.5 workflow, use the direct command unless you've tested the custom service successfully on your own configuration.

## 4. Connect the TV app to Home Assistant

The TV application needs a Home Assistant URL reachable **from the TV** and a long-lived access token. Generate a token under your Home Assistant user profile → **Security**. Consider a dedicated user with only the access needed for the camera. Treat the token like a password.

For the recommended direct `webostv.command` approach:

1. Open **Home Assistant PIP** from the LG app launcher.
2. Enter your HA URL and token. Test the connection, then **Save**.
3. Set defaults such as `mjpeg`, `top-right`, `35` (% screen width) and 30-second close time.

Alternatively, if the optional `lg_webos_pip` integration is installed, use its configuration and **Send connection to TV** action.

Use an IP address if your TV cannot resolve `homeassistant.local`. **Do not publish tokens** in screenshots, YAML examples, source files, IPKs or releases.

## 5. Test a camera manually (recommended method)

In Home Assistant, open **Developer tools → Actions** and paste the following YAML. The `entity_id` belongs under **`data:`**, not `target:`. This placement was confirmed in the tested setup; otherwise HA may report that `entity_id` is required under `data`.

```yaml
action: webostv.command
data:
  entity_id: media_player.your_lg_tv
  command: system.launcher/launch
  payload:
    id: io.github.isdaddy.lgwebospip
    params:
      camera: camera.front_door
      timeout: 10
```

Replace `media_player.your_lg_tv` with your TV's actual Home Assistant entity ID and `camera.front_door` with your real camera. Set `timeout` to the number of seconds you want the PIP displayed; for example, `30` for a doorbell alert.

The value of `payload.id` is the **internal webOS app ID**, not the installer filename. Keep `io.github.isdaddy.lgwebospip` for this version.

**Test procedure:** Start IPTV or YouTube, run the action, let the PIP close, and repeat several times. The v1.0.5 build was tested successfully with five consecutive launches over playing content on one rooted LG TV. Results are not guaranteed on every TV/app.

Optional `params` include `title`, `mode` (`mjpeg`, `snapshot`, `hls`, `webrtc`), `position` (`top-right`, etc.), `size` (percent) and `muted`. Keep the minimal working action above for initial troubleshooting. HLS/WebRTC may need an extra video decoder and are less predictable over playing content.

## 6. Trigger from a doorbell — example automation

In Home Assistant go to **Settings → Automations & scenes → Create automation → Edit in YAML**. This automation uses the **same `webostv.command` action** that was verified manually in section 5. Replace all three example entity IDs with those on your own system.

```yaml
alias: "LG TV - show doorbell camera in PIP"
description: "Display the doorbell camera on LG TV for 30 seconds"
triggers:
  - trigger: state
    entity_id: binary_sensor.front_doorbell
    to: "on"
conditions: []
actions:
  - action: webostv.command
    data:
      entity_id: media_player.your_lg_tv
      command: system.launcher/launch
      payload:
        id: io.github.isdaddy.lgwebospip
        params:
          camera: camera.front_door
          timeout: 30
mode: restart
```

- `binary_sensor.front_doorbell` — example trigger (replace with your doorbell sensor).
- `media_player.your_lg_tv` — example TV entity (replace with the exact paired LG TV entity).
- `camera.front_door` — example camera entity (replace with yours).

The **launch action** was tested manually on v1.0.5; the **end-to-end doorbell automation** is illustrative and should be tested with your own sensor. If the doorbell state is an event rather than an `on`/`off` binary sensor, adapt the trigger accordingly.

If you also use the custom integration's **Add PIP trigger** UI, avoid configuring both trigger methods for the same event or the PIP may open twice.

## 7. Screensaver behavior

The TV app attempts to wake the screen **when it receives a PIP launch request**, without requiring a separate Home Assistant wake automation. On supported rooted TVs the modified app uses the Homebrew privileged service path, with retries. The ordinary webOS fallback may fail on non-rooted TVs. This is a **best-effort wake**, not a guaranteed way to bypass every screensaver or power state.

The application does not power on a fully powered-off TV. The integration normally skips PIP requests if the TV is off. The overlay also temporarily receives remote-control focus; Back or OK should close it, and the earlier application should regain control. Keep notification timeouts short.

## 8. Troubleshooting

| Symptom | Suggested check |
| --- | --- |
| TV app not listed | Confirm IPK installation, installed version and Developer Mode status if applicable |
| `webostv.command` says `entity_id` is required under `data` | Put `entity_id: media_player.your_lg_tv` inside the **`data:`** mapping, not `target:` |
| PIP works from TV SSH but not from `lg_webos_pip.show` | Test the documented direct **`webostv.command`** launch with the correct `media_player.*` ID |
| PIP works only in HOME or disappears over YouTube/IPTV | Test v1.0.5 with the original stable overlay CSS; do not enable experimental overlay animations. Compare repeated direct launches |
| Camera unavailable | Confirm the TV can reach the HA URL, camera entity and access token |
| MJPEG black/blank | Test `snapshot`, check HA logs and stream support |
| Remote arrows/OK do not recover | Press Back or wait for the PIP timeout; report model/firmware if reproducible |
| Screensaver covers PIP | Root Homebrew service access may be absent or blocked on your firmware |
| `npm run build` cannot find `hls.min.js` | Run `npm.cmd install --include=dev` in `webos-app` before building |
| `ares-package` reports missing `appinfo.json` | Build first, then package the **`build` directory** (`ares-package build -o dist`) |
| Can't exit SSH | Check `jobs`; stop only the applicable suspended job |

## 9. Build from source (developers)

From **Windows PowerShell** (after installing Node.js and the webOS CLI):

```powershell
git clone https://github.com/tixelcat/ha-lg-webos-pip.git
cd .\ha-lg-webos-pip\webos-app
npm.cmd install --include=dev
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
if (-not (Test-Path '.\build\lib\hls.min.js')) { throw 'HLS dependency missing' }
ares-package build -o dist
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
Get-ChildItem .\dist\*.ipk
```

The `v1.0.5-tixelcat` release tag identifies the published source version. The version of the generated installer is taken from `app/appinfo.json` in your checkout. Build output must have `build/appinfo.json`; **do not package the source `app/` directory or run `ares-package` without first building**.

Never commit `.env` files, tokens or credentials or distribute an IPK with a baked-in Home Assistant token. The installer asset may be **renamed** to `io.github.tixelcat.lgwebospip_1.0.5_all.ipk` for the tixelcat release; that filename does not change the package's internal ID.

## 10. Credits and license

Original project: [ISDaddy/ha-lg-webos-pip](https://github.com/ISDaddy/ha-lg-webos-pip) (MIT license). Modifications and documentation: [tixelcat](https://github.com/tixelcat). Preserve the original license and notices; see [`LICENSE`](LICENSE) and [`MODIFICATIONS.md`](MODIFICATIONS.md). This is a community fork, not an official LG or Home Assistant product.
