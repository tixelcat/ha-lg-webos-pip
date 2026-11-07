# Home Assistant PIP — Installation and configuration

**Enhanced LG webOS fork by [tixelcat](https://github.com/tixelcat), based on the original work by [ISDaddy](https://github.com/ISDaddy).**

This guide covers the **v1.0.4-tixelcat** TV app and the `lg_webos_pip` Home Assistant integration. The TV app displays a Home Assistant camera as a picture-in-picture overlay on compatible LG webOS TVs. The tixelcat fork includes improvements to overlay cleanup, MJPEG playback, remote-control recovery and a best-effort screensaver wake-up path.

> **Compatibility:** The original project was tested on LG OLED G4 / webOS 24 in Developer Mode. The enhanced overlay and rooted screensaver wake-up were user-tested on one rooted LG webOS TV with Homebrew Channel. The fork's extra behavior has **not** been verified across all LG models or on unrooted TVs. Rooting is optional; rooted screensaver wake-up requires the relevant Homebrew service.

## 1. Requirements

- An LG webOS TV compatible with webOS overlay applications, connected to the same reachable network as Home Assistant.
- Home Assistant 2025.3+ and a working `camera.*` entity for live preview.
- The built-in **LG webOS TV** integration already paired with the TV (Settings → Devices & services).
- The **LG webOS PIP** custom integration (installed below).
- One TV-app installation route: **A — rooted/Homebrew + SSH**, or **B — non-root Developer Mode**.
- A recent, supported Windows/macOS/Linux computer, if transferring or installing the IPK.

**Download:** [v1.0.4-tixelcat release](https://github.com/tixelcat/ha-lg-webos-pip/releases/tag/v1.0.4-tixelcat) → Assets → `lgwebospip_tixelcat_1.0.4_all.ipk`.

> The **filename can differ from the application ID**. Do not change the internal application ID `io.github.isdaddy.lgwebospip`; the Home Assistant integration expects that ID.

## 2A. Install on a rooted LG TV (Homebrew Channel + SSH)

Root access is **not required** for basic PIP, but is recommended only for experienced users who specifically need the rooted screensaver wake-up feature. Before considering rooting, check model and firmware support at [CanI.RootMy.TV](https://cani.rootmy.tv/), [webOS Homebrew rooting documentation](https://www.webosbrew.org/rooting/) and [RootMy.TV](https://rootmy.tv/). Some methods are patched by LG firmware. Rooting can damage a TV or affect warranty/support. **Do not combine Developer Mode setup with a rooted configuration without checking webOS Homebrew guidance.**

1. Install and configure [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel), including working root SSH access, using that project's documentation.
2. Download the `.ipk` to your computer, e.g. the `Downloads` folder.
3. Find your TV IP address. The example below uses `192.168.1.100`: **replace it with your own TV address**.
4. From **Windows PowerShell** (not the TV's SSH shell), run:

```powershell
$TV_IP = '192.168.1.100'
$IPK = "$HOME\Downloads\lgwebospip_tixelcat_1.0.4_all.ipk"
if (-not (Test-Path $IPK)) { throw "IPK not found: $IPK" }
scp $IPK "root@${TV_IP}:/tmp/home-assistant-pip.ipk"
ssh "root@$TV_IP"
```

5. **Now on the TV SSH shell**, verify the file, close an earlier instance, and initiate installation:

```sh
ls -lh /tmp/home-assistant-pip.ipk
luna-send -n 1 luna://com.webos.applicationManager/closeByAppId '{"id":"io.github.isdaddy.lgwebospip"}'
luna-send -n 1 luna://com.webos.appInstallService/dev/install '{"id":"io.github.isdaddy.lgwebospip","ipkUrl":"/tmp/home-assistant-pip.ipk","subscribe":false}'
```

6. `-n 1` only returns the initial service response. **Do not interpret it as an installation-complete message.** Check the installed manifest after installation has completed:

```sh
cat /media/developer/apps/usr/palm/applications/io.github.isdaddy.lgwebospip/appinfo.json | grep -E '"(id|title|version)"'
```

Expected internal ID `io.github.isdaddy.lgwebospip`, title `Home Assistant PIP`, version `1.0.4`. If the path differs on your firmware, find the installed application using your TV's application manager.

7. Start the app (or launch it from the TV's app list):

```sh
luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"io.github.isdaddy.lgwebospip"}'
exit
```

> **SSH troubleshooting:** If `exit` reports `You have stopped jobs`, inspect `jobs` and terminate only the stopped `luna-send` job you started, e.g. `kill -9 %1` when `jobs` confirms it is job 1. Avoid broad process-kill commands.

## 2B. Install on a non-root LG TV (Developer Mode)

1. Create an LG developer account at [webOS TV Developer](https://webostv.developer.lge.com/).
2. Install **Developer Mode** from LG Content Store. Log in, enable **Dev Mode Status**, and after restart enable **Key Server**.
3. Install Node.js and the webOS CLI on your computer:

```powershell
npm.cmd install -g @webos-tools/cli
```

4. Register your TV (replace the IP) and retrieve the SSH key. Enter the *Developer Mode app's passphrase*, not a root password:

```powershell
ares-setup-device -a tv -i "host=192.168.1.100" -i "port=9922" -i "username=prisoner" -i "default=true"
ares-novacom --device tv --getkey
```

5. Install the downloaded file from its directory:

```powershell
cd "$HOME\Downloads"
ares-install -d tv .\lgwebospip_tixelcat_1.0.4_all.ipk
ares-install -d tv --list
ares-launch -d tv io.github.isdaddy.lgwebospip
```

Developer Mode access expires unless renewed. Read the current expiry notice inside the Developer Mode app. **Screensaver wake-up using Homebrew root privileges is unavailable in this mode**, and the non-root fallback is experimental.

## 3. Install the Home Assistant integrations

1. In Home Assistant, add the built-in **LG webOS TV** integration and pair your TV via Settings → Devices & services → Add integration.
2. Install [HACS](https://www.hacs.xyz/) if necessary. In HACS → Custom repositories, add **`https://github.com/tixelcat/ha-lg-webos-pip`** as **Integration**, install **LG webOS PIP**, then restart HA.
3. Alternatively, copy `custom_components/lg_webos_pip/` from the repository to HA `/config/custom_components/lg_webos_pip/` and restart HA.
4. In Settings → Devices & services → Add integration, select **LG webOS PIP**.
5. Choose the LG TV media-player entity, supply a Home Assistant URL **reachable by the TV** (example `http://192.168.1.10:8123`), and configure the token if prompted. Keep the app ID `io.github.isdaddy.lgwebospip`.

## 4. Connect the TV app to Home Assistant

Create a **long-lived access token** in your HA user profile → Security. Consider a dedicated, limited-privilege HA account for TV access. Treat the token as a password.

Choose either method:

- In the PIP integration, configure the URL/token and use **Send connection to TV**, or
- Open the PIP application on the TV, enter the HA URL and token, **Test connection**, then **Save**.

Default configuration to start with: `mjpeg`, `top-right`, `35` (% screen width), `30` seconds, muted. Use the **TV's network perspective** for the HA URL; `homeassistant.local` may fail to resolve. Do not put tokens in public Git repositories, `.env` files uploaded to releases, or screenshots.

## 5. Test a camera manually

Home Assistant → Developer tools → Actions; call:

```yaml
action: lg_webos_pip.show
data:
  camera: camera.front_door
  title: "Front door"
  mode: mjpeg
  position: top-right
  size: 35
  timeout: 30
  muted: true
```

Replace `camera.front_door` with an actual camera entity. If MJPEG isn't available, try `mode: snapshot`. `hls`/`webrtc` may require another hardware decoder, so behavior depends on the TV and playing content.

## 6. Trigger from a doorbell

Create an automation via Settings → Automations & scenes → Create → Edit in YAML. Replace both example entity IDs:

```yaml
alias: "LG TV - doorbell camera PIP"
triggers:
  - trigger: state
    entity_id: binary_sensor.front_doorbell
    from: "off"
    to: "on"
conditions: []
actions:
  - action: lg_webos_pip.show
    data:
      camera: camera.front_door
      title: "Someone is at the door"
      mode: mjpeg
      position: top-right
      size: 35
      timeout: 30
      muted: true
mode: restart
```

Alternatively, use the integration's **Add PIP trigger** UI, select the triggering sensor and camera, and use its **Test** button. Avoid enabling both the UI trigger and a separate automation for the same event.

## 7. Screensaver behavior

The TV app attempts to wake the screen **when it receives a PIP launch request**, without requiring a separate Home Assistant wake automation. On supported rooted TVs the modified app uses the Homebrew privileged service path, with retries. The ordinary webOS fallback may fail on non-rooted TVs. This is a **best-effort wake**, not a guaranteed way to bypass every screensaver or power state.

The application does not power on a fully powered-off TV. The integration normally skips PIP requests if the TV is off. The overlay also temporarily receives remote-control focus; Back or OK should close it, and the earlier application should regain control. Keep notification timeouts short.

## 8. Troubleshooting

| Symptom | Suggested check |
| --- | --- |
| TV app not listed | Check successful IPK installation, installed version, or Developer Mode expiry |
| PIP action missing | Verify HACS/manual integration install and restart HA |
| Camera unavailable | Verify the camera entity, HA connectivity and access token |
| MJPEG black/blank | Test `snapshot`, inspect HA logs and stream compatibility |
| Background turns black | Confirm modified TV app v1.0.4; test different TV apps/sources and report model/firmware |
| Remote arrows/OK don't recover | Try Back, wait for timeout; document TV model/firmware and open an issue if reproducible |
| Screensaver covers PIP | Root/Homebrew privileges may be missing, or your firmware may block wake calls |
| `ares-package` reports missing `appinfo.json` | Build first (`npm run build`); package the generated build directory |
| Can't exit SSH | Check `jobs`; stop only the appropriate suspended command |

## 9. Build from source (developers)

```sh
git clone https://github.com/tixelcat/ha-lg-webos-pip.git
cd ha-lg-webos-pip/webos-app
npm install
npm run build
```

Package the resulting **`build/`** directory using `ares-package` (webOS CLI); do not run `ares-package .` against the source directory unless `appinfo.json` is at its root. Never commit `.env` files or embed a real HA token in a publicly distributed IPK.

## 10. Credits and license

Original project: [ISDaddy/ha-lg-webos-pip](https://github.com/ISDaddy/ha-lg-webos-pip) (MIT license). Modifications and documentation: [tixelcat](https://github.com/tixelcat). Preserve the original license and notices; see [`LICENSE`](LICENSE) and [`MODIFICATIONS.md`](MODIFICATIONS.md). This is a community fork, not an official LG or Home Assistant product.
