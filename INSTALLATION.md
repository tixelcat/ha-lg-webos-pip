# Home Assistant PIP 1.0.6 — Installation and configuration

Enhanced LG webOS PIP fork by [tixelcat](https://github.com/tixelcat), based on the MIT-licensed [ISDaddy project](https://github.com/ISDaddy/ha-lg-webos-pip). This guide covers **version 1.0.6**, the dual-camera interface and the recommended saved-layout Home Assistant action.

**Download:** [tixelcat GitHub Releases](https://github.com/tixelcat/ha-lg-webos-pip/releases) → **1.0.6** → Assets → **`io.github.tixelcat.lgwebospip_1.0.6_all.ipk`**. The file must be attached to the published release; until then use the locally verified 1.0.6 test IPK. Never rename the internal application ID just because the IPK filename says `tixelcat`.

| Meaning | Value |
| --- | --- |
| Public release/version | `1.0.6` (no leading `v`) |
| Downloaded package filename | `io.github.tixelcat.lgwebospip_1.0.6_all.ipk` |
| **Internal webOS application ID** | **`io.github.isdaddy.lgwebospip`** |
| Recommended HA action | `webostv.command` |
| Recommended saved layout | `params: {show_saved: true}` |

## 1. Requirements

- LG webOS TV that permits installation of the TV app and supports overlay windows. **Root access is optional** for basic PIP.
- A working Home Assistant server and at least one usable `camera.*` entity.
- The **built-in LG webOS TV integration** paired with your television in Home Assistant; find its `media_player.*` entity.
- A Home Assistant long-lived access token, kept private, and a URL reachable **from the TV**. A dedicated, appropriately restricted HA user is recommended where practical.
- A computer with SSH/SCP for a rooted/Homebrew TV, or Node.js and the webOS CLI for a Developer Mode TV.

The custom `lg_webos_pip` integration in this repository is **optional** for `webostv.command` and is not needed for the recommended saved-layout automation.

## 2A. Install or update on a rooted LG TV (Homebrew + SSH)

Rooting can carry risks and may be unavailable on current firmware. If you don't already have root, consult [CanI.RootMy.TV](https://cani.rootmy.tv/) and [webOS Homebrew](https://www.webosbrew.org/rooting/) before attempting it. The rooted screensaver-wake enhancement requires a compatible privileged Homebrew service.

1. Confirm Homebrew root SSH access and download the 1.0.6 IPK to your computer.
2. **On your computer in Windows PowerShell**, enter the commands below. Change the example TV IP and IPK location as required. Quoted SCP arguments and `${TV_IP}` support Windows PowerShell 5.1.

```powershell
$TV_IP = '192.168.1.100'  # replace with your TV IP
$IPK = Join-Path $HOME 'Downloads\io.github.tixelcat.lgwebospip_1.0.6_all.ipk'
# Example alternative if you built the IPK locally:
# $IPK = Join-Path $HOME 'Downloads\HA PIP WEBOS\Releases\1.0.6\io.github.tixelcat.lgwebospip_1.0.6_all.ipk'
if (-not (Test-Path -LiteralPath $IPK)) { throw "IPK not found: $IPK" }
scp "$IPK" "root@${TV_IP}:/tmp/home-assistant-pip-1.0.6.ipk"
if ($LASTEXITCODE -ne 0) { throw 'SCP upload failed' }
ssh "root@${TV_IP}"
```

3. **Only in the TV's SSH/Linux shell** (after `ssh` connects), check the file, close the running overlay and install the update:

```sh
ls -lh /tmp/home-assistant-pip-1.0.6.ipk
luna-send -n 1 luna://com.webos.applicationManager/closeByAppId '{"id":"io.github.isdaddy.lgwebospip"}'
luna-send -n 1 luna://com.webos.appInstallService/dev/install '{"id":"io.github.isdaddy.lgwebospip","ipkUrl":"/tmp/home-assistant-pip-1.0.6.ipk","subscribe":false}'
```

The close request may indicate that the app is not running; this is harmless. The initial install response reports submission, **not necessarily completion**. Allow the TV to finish installing before verifying the version.

4. After installation, examine the manifest at the usual location (the path can differ by firmware):

```sh
cat /media/developer/apps/usr/palm/applications/io.github.isdaddy.lgwebospip/appinfo.json | grep -E '"(id|version|title)"'
```

Expected internal ID `io.github.isdaddy.lgwebospip`, version `1.0.6`, title `Home Assistant PIP`.

5. Start the app from the LG app launcher or via SSH:

```sh
luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"io.github.isdaddy.lgwebospip"}'
exit
```

`luna-send` commands are **TV-side Linux commands**, not Windows PowerShell commands. If SSH reports stopped jobs on exit, inspect `jobs` and stop only a specific relevant suspended job; avoid broad process termination.

## 2B. Install on a non-root TV (LG Developer Mode)

This route is provided for compatible TVs; dual-camera and privileged screensaver behavior have not been verified across unrooted models.

1. Register for an account at [LG webOS TV Developer](https://webostv.developer.lge.com/).
2. Install and enable **Developer Mode** on the TV, including its **Key Server**.
3. Install Node.js and the webOS CLI on your computer:

```powershell
npm.cmd install -g @webos-tools/cli
```

4. Pair the TV (replace the example IP) and retrieve its Developer Mode key; use the Developer Mode app's passphrase rather than a root password:

```powershell
ares-setup-device -a tv -i "host=192.168.1.100" -i "port=9922" -i "username=prisoner" -i "default=true"
ares-novacom --device tv --getkey
```

5. Install and launch the downloaded package:

```powershell
$IPK = Join-Path $HOME 'Downloads\io.github.tixelcat.lgwebospip_1.0.6_all.ipk'
if (-not (Test-Path -LiteralPath $IPK)) { throw "IPK not found: $IPK" }
ares-install -d tv "$IPK"
if ($LASTEXITCODE -ne 0) { throw 'Installation failed' }
ares-install -d tv --list
ares-launch -d tv io.github.isdaddy.lgwebospip
```

Developer Mode access expires and may require renewal. Root-only Homebrew screensaver wake is not available through this route.

## 3. Configure Home Assistant once on the TV

1. Pair the TV in Home Assistant using the **built-in LG webOS TV** integration (**Settings → Devices & services**). Identify the correct `media_player.*` entity.
2. From the TV launcher, open **Home Assistant PIP**. You should see **Home Assistant connection** at the top, followed by two side-by-side camera columns and **Save / Preview / Exit** at the bottom.
3. In the TV app, enter the **HA URL** reachable from the TV (for example, `http://homeassistant.local:8123` if DNS works on the TV) and the **long-lived access token** from the HA user profile → Security. Do not share the token or store it in the public repository.
4. Select **Test connection**. It should confirm the connection and discover the `camera.*` entities that the configured HA user can access. Both camera selectors use this same list and connection.
5. In **Camera 1** and **Camera 2**, choose the desired source; select a corner, select the size and choose **Show camera: On/Off** independently. The cameras can use any two *different* corners when both enabled; a disabled/empty camera frees its corner.
6. Use **Size** values 10%, 20%, 30%, 40%, 50% of TV width. Dual PIP windows use the same 16:9 frame geometry; two cameras at 30% therefore have equal outer dimensions even if their stream ratios differ. Each camera fits within its frame without stretching.
7. Set the shared **Stream** mode (MJPEG is recommended for live TV overlays) and **Close after** setting (for example, 30 seconds, or Never to close via Back/OK).
8. Press **Save**. Use **Preview** to verify both slots and their positioning. A camera switch does not clear its saved source, size or corner.

### Show camera switches

| Camera 1 | Camera 2 | Action result |
| --- | --- | --- |
| On | On | Show both selected cameras in two different corners |
| On | Off | Only Camera 1 |
| Off | On | Only Camera 2 |
| Off | Off | Show no cameras and close the app |

Selecting a blank/None source means that slot is not displayed even if its switch is On. Opening the application from the TV's launcher without launch parameters opens the **settings** screen; that is normal.

## 4. Launch saved cameras — recommended action

In Home Assistant open **Developer tools → Actions** and run:

```yaml
action: webostv.command
data:
  entity_id: media_player.your_lg_tv
  command: system.launcher/launch
  payload:
    id: io.github.isdaddy.lgwebospip
    params:
      show_saved: true
```

**This minimal command was verified on a real TV with version 1.0.6.** It uses all saved TV settings: camera identities, positions, sizes, On/Off switches, streaming mode and **Close after** time. **No `timeout`, `size` or `position` is required in HA.** Replace `media_player.your_lg_tv` with the built-in LG webOS TV entity. Keep `entity_id` **inside `data:`**; do not move it into `target:` for this action.

You can optionally supply a title, without overriding saved cameras:

```yaml
action: webostv.command
data:
  entity_id: media_player.your_lg_tv
  command: system.launcher/launch
  payload:
    id: io.github.isdaddy.lgwebospip
    params:
      show_saved: true
      title: "🔔 Someone is at the door!"
```

The title is displayed on the first enabled/active camera window. The title is optional; it is not a size or timing setting.

### Backward compatibility: explicit single-camera action

The previous 1.0.5-style action still works and **ignores both saved On/Off switches**:

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

`camera` specifies the single camera to show immediately. Do not use `show_saved` when you want to override the saved camera selection. Other optional explicit-launch parameters include `mode`, `position`, `size`, `title` and `muted`.

## 5. Doorbell automation — both saved cameras

Add an automation in **Settings → Automations & scenes**. Edit it in YAML and replace the example `binary_sensor` and `media_player` IDs:

```yaml
alias: "LG TV - live doorbell cameras"
description: "Show the saved TV cameras when the doorbell rings"
triggers:
  - trigger: state
    entity_id: binary_sensor.front_doorbell
    from: "off"
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
          show_saved: true
          title: "🔔 Someone is at the door!"
mode: restart
```

There is **no `timeout`** because the TV's saved **Close after** setting controls duration. The YAML keys `actions` and nested `data` must be correctly indented. This trigger works only if the doorbell sensor actually changes from `off` to `on`; use a different trigger type for event-driven doorbells.

The optional custom `lg_webos_pip` integration is not required. If you already use its automatic trigger configuration, avoid setting up both methods for the same event unless you explicitly want two launches. In the tested setup `webostv.command` was more reliable than the custom `lg_webos_pip.show` service.

## 6. Build from source — developers

You need Node.js, npm and the webOS CLI (`ares-package`). In **Windows PowerShell**:

```powershell
git clone https://github.com/tixelcat/ha-lg-webos-pip.git
cd .\ha-lg-webos-pip\webos-app
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'App build failed' }
if (-not (Test-Path '.\build\lib\hls.min.js')) { throw 'Missing HLS dependency' }
ares-package build -o dist
if ($LASTEXITCODE -ne 0) { throw 'IPK packaging failed' }
Get-ChildItem .\dist\*.ipk
```

The webOS manifest must show version **1.0.6** and the legacy app ID **`io.github.isdaddy.lgwebospip`**. `ares-package` may name the file using the internal ID, e.g. `io.github.isdaddy.lgwebospip_1.0.6_all.ipk`; the public release asset is **renamed** to `io.github.tixelcat.lgwebospip_1.0.6_all.ipk`. Renaming the file does **not** change the internal app ID.

**Build safety:** `webos-app/scripts/build.mjs` can embed HA values from a local `.env` file or environment variables into `build/config.js`. Before building an IPK for public release, verify `build/config.js` contains **`window.HA_CONFIG = {};`** and no real token, password or private address. The tested attached IPK was separately checked for this.

## 7. Troubleshooting

| Symptom | What to check |
| --- | --- |
| A `show_saved` command opens the settings menu instead of cameras | Confirm **TV app 1.0.6** is installed; `show_saved` is not supported by older 1.0.5 app builds |
| One camera is absent | Open TV settings; verify its **Show camera** switch, selected camera entity and HA permissions; Save |
| Both camera windows are absent | Both switches Off, empty camera selections or HA connection failure; use **Test connection** |
| Both cameras try to use the same corner | Assign different corners; turning the other camera Off frees the corner |
| 30% windows have different physical sizes | Confirm the updated 1.0.6 dual-window build, which enforces equal 16:9 outer frames |
| HA reports missing `entity_id` | For `webostv.command`, place `entity_id` **under `data:`** |
| `show_saved` displays the wrong camera or size | Check TV settings, press **Save**, and retry; remove explicit legacy `camera`, `size` or `position` from the HA call |
| PIP appears over the TV home screen but not over IPTV/YouTube | Check webOS overlay compatibility and avoid experimental CSS transitions/alternative player implementations |
| A camera fails to connect | Verify HA URL, token, entity, network connectivity; MJPEG is recommended over video playback |
| Remote buttons stay captured | Use Back/OK to close PIP or a TV-configured auto-close time; report TV model and firmware for persistent issues |
| Screensaver remains above the PIP | Homebrew privileged wake may be unsupported/blocked on your firmware |
| Developer Mode app disappears | Check Developer Mode session expiry and renew if needed |
| WebOS CLI build fails | Run `npm.cmd ci` first and package the **build** directory |

## 8. Compatibility, security and attribution

This community fork's improvements have been exercised on a rooted LG TV including multiple PIP launches while IPTV/YouTube were active, screensaver wake, and the 1.0.6 dual-camera controls. They have **not** been systematically validated across all LG devices, firmware and protected video apps. Root access is only necessary for the optional privileged screensaver wake path. The application does not power on a TV that is fully off.

Protect the Home Assistant token. Do not publish `.env`, `config.js` generated with HA secrets, localStorage content, personal logs or access tokens. See [README.md](README.md), [MODIFICATIONS.md](MODIFICATIONS.md) and [LICENSE](LICENSE). Original author [ISDaddy](https://github.com/ISDaddy), enhancements by [tixelcat](https://github.com/tixelcat); MIT license and original notices retained.
