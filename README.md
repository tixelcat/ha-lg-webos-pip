
[![Download Latest Release](https://img.shields.io/badge/Download-Latest%20IPK-blue?style=for-the-badge&logo=github)](https://github.com/tixelcat/ha-lg-webos-pip/releases/latest)

# LG webOS PIP for Home Assistant

Show a Home Assistant camera, or any video feed, as a **small picture-in-picture box on your LG TV**, on top of whatever you're watching: live TV, HDMI, Netflix, the home screen. Typical use: someone rings the doorbell and the door camera appears in the corner of the TV for 30 seconds.

```
┌──────────────────────────────────────────┐
│ live TV / HDMI / any app   ┌───────────┐ │
│                            │  camera   │ │
│                            │ Doorbell  │ │
│                            └───────────┘ │
└──────────────────────────────────────────┘
```

The repository has two parts that work together:

| Part | Where | What it does |
|---|---|---|
| **HA PIP** TV app | [`webos-app/`](webos-app) | A webOS app that opens as a transparent overlay window and draws the PIP box. It has its own setup screen for the HA connection and defaults. |
| **LG webOS PIP** integration | [`custom_components/lg_webos_pip/`](custom_components/lg_webos_pip) | A Home Assistant integration with a UI for choosing *what* to show, *when* (triggers), *where* and *for how long*. It launches the TV app through HA's built-in LG webOS TV integration. |

Verified on an LG OLED G4 (webOS 24, firmware 43.21.73) in Developer Mode, without rooting.
## Recommended setup: Rooted LG webOS + Homebrew Channel

For the best experience with Home Assistant PIP, consider using a rooted LG webOS TV with [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

Root access is **optional**, but it enables additional features that are not always available through standard Developer Mode.

### Benefits of a rooted LG TV

- **Screensaver wake-up:** Automatically attempt to dismiss the active screensaver when a camera notification is displayed.
- **Homebrew Channel:** Manage homebrew applications and updates.
- **SSH access:** Install, update and troubleshoot applications directly on the TV.
- **Extended system access:** Access additional webOS services for advanced automation.

### How to root your LG TV

Before attempting to root your television, check compatibility and available methods:

- [Check TV compatibility – CanI.RootMy.TV](https://cani.rootmy.tv/)
- [RootMy.TV](https://rootmy.tv/)
- [webOS Homebrew – Rooting Guide](https://www.webosbrew.org/rooting/)
- [Homebrew Channel on GitHub](https://github.com/webosbrew/webos-homebrew-channel)

**Important:** RootMy.TV exploits have been patched on many newer firmware versions. Rooting is not supported by LG, may affect warranty coverage and carries a risk of damaging the television. Always check model and firmware compatibility before proceeding.

### Non-rooted televisions

Home Assistant PIP can also be installed using LG Developer Mode without root access.

Basic camera overlay functionality is supported on compatible devices. However, enhanced screensaver wake-up and other root-dependent features may be unavailable.

**Recommendation:** Use Homebrew Channel on a supported rooted TV when advanced automation and screensaver wake-up are important. Developer Mode remains an alternative for users who do not want to root their television.

---

**Original project:** [ISDaddy/ha-lg-webos-pip](https://github.com/ISDaddy/ha-lg-webos-pip)

**Enhanced fork and modifications:** [tixelcat](https://github.com/tixelcat)

**License:** MIT – original copyright notices and license terms retained.

## How it works

1. A trigger fires in Home Assistant, e.g. the doorbell's binary sensor turns `on`.
2. Home Assistant calls `webostv.command` -> `system.launcher/launch` with the TV app ID and camera/timeout parameters (directly or through the optional custom integration).
3. The app opens as an **overlay window** (`"defaultWindowType": "overlay"`, `"transparent": true`). Only the PIP box is visible over the current picture.
4. The app connects to Home Assistant's WebSocket API with a long-lived token and asks HA for a signed stream URL. MJPEG by default; HLS, WebRTC and snapshots are also available.
5. After the timeout, or when you press **Back** / **OK**, the app closes and the TV is exactly as before.

## Requirements

- An LG webOS TV with the **LG webOS TV** integration set up in Home Assistant. Tested: G4 / webOS 24. Older webOS versions may work, untested.
- Home Assistant **2025.3** or newer.
- To install the TV app, use compatible **rooted/Homebrew SSH** or **Developer Mode** as described in [INSTALLATION.md](INSTALLATION.md).
- A computer with Node.js 18+ for the webOS CLI.

## Setup

### 1. Install the TV app

Choose a rooted/Homebrew SSH installation or an LG Developer Mode installation. See the complete, version-specific [INSTALLATION.md](INSTALLATION.md), including working PowerShell/SCP and TV-side commands.

**v1.0.5 installer filename:** `io.github.tixelcat.lgwebospip_1.0.5_all.ipk` (available from the v1.0.5-tixelcat GitHub release). The filename uses **tixelcat**, but the internal app ID remains **`io.github.isdaddy.lgwebospip`** for compatibility with existing integrations and TV installations.

Download the asset from the [tixelcat releases page](https://github.com/tixelcat/ha-lg-webos-pip/releases/latest) for v1.0.5-tixelcat.

### 2. Connect the TV app to Home Assistant

The app needs your HA URL and a long-lived access token. Create the token in HA under **your profile → Security → Long-lived access tokens**. A dedicated non-admin HA user for the TV is a good idea. Then do **one** of the following:

- **From Home Assistant (easiest):** enter the URL and token in the integration (step 3). HA sends them to the TV app, and you never type the token with the remote.
- **On the TV:** open **HA PIP** from the TV's app list. The setup screen appears:

  | Setting | |
  |---|---|
  | Home Assistant URL | e.g. `http://192.168.1.10:8123` (use an IP if the TV can't resolve `homeassistant.local`) |
  | Long-lived access token | Type it with the on-screen keyboard. The **LG ThinQ** phone app's keyboard can paste it from your phone. |
  | Test connection | Shows the HA version, the user and how many cameras were found |
  | Camera, Stream, Position, Size, Close after | Defaults, used when HA doesn't say otherwise |
  | Preview | Shows the PIP with the current (unsaved) settings. **OK** or **Back** returns to setup. |

  Navigate with **▲▼**, change choices with **◀▶**, press **OK** to type in a field or press a button. The Magic Remote pointer also works. Press **Save** before exiting.

### 3. Install the Home Assistant integration (optional)

For the **recommended `webostv.command` launch**, you need only Home Assistant's **built-in LG webOS TV** integration paired with your TV. The custom **LG webOS PIP** integration is optional.

For its additional UI and trigger management, add `https://github.com/tixelcat/ha-lg-webos-pip` to HACS as a custom Integration, install **LG webOS PIP**, and restart Home Assistant. Or copy `custom_components/lg_webos_pip` to `/config/custom_components/lg_webos_pip` and restart. In Settings -> Devices & services, add **LG webOS PIP** and configure the TV/connection settings.

**Compatibility note:** In one tested environment `lg_webos_pip.show` did not relaunch reliably, whereas repeated direct `webostv.command` launches succeeded over IPTV and YouTube. Start with the direct method below.

### 4. Add PIP triggers

On the integration page, click **Add PIP trigger**. Each trigger says *when X happens, show Y*:

| Field | |
|---|---|
| Name | e.g. `Doorbell` |
| Trigger entities | one or more entities, e.g. `binary_sensor.doorbell` or `event.doorbell_ring` |
| Trigger state | optional. Empty means binary sensors, switches and input booleans fire on `on`, and everything else (e.g. **event entities**) fires on every change. Set it to fire on a specific state, like `open`. |
| Camera *or* URL | what to show (see [Sources](#sources)) |
| Label, stream type, position, size, close after | optional per-trigger overrides |

Each trigger gets its own device with:
- **Enabled**, a switch to pause the trigger, e.g. at night.
- **Test**, a button that shows the PIP now.

Edit a trigger later with its **⋮ → Reconfigure** menu.

**Nothing is ever sent to a TV that is off.** Triggers and the `show` / `close` actions skip quietly, so automations don't fail. Buttons report that the TV is off.

The TV also gets three buttons: **Send connection to TV**, **Open setup on TV** and **Close PIP**.

## Using it from automations and scripts

**Recommended and tested with v1.0.5:** use the built-in `webostv.command` action. In Home Assistant -> Developer tools -> Actions, use this minimal YAML:

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

Replace `media_player.your_lg_tv` and `camera.front_door` with actual entity IDs. **Keep `entity_id` under `data:`, not `target:`**; the wrong placement produces an HA validation error on the tested configuration. The package filename may say `tixelcat`, but `payload.id` must match the current internal app ID `io.github.isdaddy.lgwebospip`.

Example doorbell automation using the same launch command:

```yaml
alias: "LG TV - doorbell camera PIP"
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

Replace the trigger sensor, TV and camera IDs. The direct launch has been verified with repeated manual requests; the complete doorbell automation is an **example**, not a separately verified end-to-end test.

The optional custom `lg_webos_pip` integration also offers `lg_webos_pip.show`, `lg_webos_pip.close` and a trigger UI. Test its relaunch behavior before relying on it for an automation. See [INSTALLATION.md](INSTALLATION.md) for installation, screensaver limitations and troubleshooting.

### Sources

- **Camera entity**: any HA camera. HA signs the stream URLs, so the token never appears in a URL.
- **URL**:
  - `.m3u8` plays as HLS.
  - URLs that look like MJPEG (`mjpeg`, `.cgi`, `action=stream`) or images display as an image stream.
  - Anything else plays in a video player, e.g. `.mp4`.
  - HA paths such as `/media/local/doorbell.mp4` are signed automatically.

### Stream types

| Type | Notes |
|---|---|
| `mjpeg` (default) | Drawn as an image, so it works over live TV without a second video decoder. HA converts the stream, which costs some HA CPU. Verified on the G4. |
| `snapshot` | Polls still images (2 per second by default). Works with every camera. |
| `hls` | Real video with audio, a few seconds behind. Needs a second hardware decoder while the TV plays something, which depends on the model and content. |
| `webrtc` | Lowest latency (HA 2024.11+ with go2rtc). Same decoder caveat as HLS. |

## Launch parameters (advanced)

To launch the TV app another way (e.g. `webostv.command` directly, or `ares-launch`), these are its parameters:

```yaml
action: webostv.command
data:
  entity_id: media_player.your_lg_tv
  command: system.launcher/launch
  payload:
    id: io.github.isdaddy.lgwebospip
    params:
      camera: camera.front_door
      timeout: 30
```

| Param | Meaning |
|---|---|
| `camera` / `url` | what to show (`url` wins) |
| `title` | label in the box (default: camera name) |
| `mode` | `mjpeg`, `snapshot`, `hls`, `webrtc` |
| `position` | `top-right`, `top-left`, `bottom-right`, `bottom-left` |
| `size` | width in % of the screen (10–100) |
| `timeout` | seconds until it closes, `0` = until closed |
| `muted` | `false` to play audio (HLS, WebRTC, video URLs) |
| `refresh` | ms between stills in `snapshot` mode (default 500) |
| `close: true` | close the PIP |
| `connect: {url, token}` | store the HA connection on the TV |
| `settings: true` (or no params) | open the setup screen |

Launching again while the PIP is open swaps the feed and restarts the timer.

## Good to know

- **While the PIP is visible it has the remote's focus.** Arrow keys go to the PIP rather than the app underneath, and **Back** or **OK** close it. Keep timeouts short for popups.
- If HA or the camera doesn't answer, the PIP shows the error and retries every 3 s until it times out.
- The token is stored in the TV app's local storage, and in the integration's options if you entered it there.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens on a trigger | Check the trigger's **Enabled** switch and that the TV's media player is `on`, then press the trigger's **Test** button. Look in **Settings → System → Logs** for `lg_webos_pip`. |
| "The LG webOS TV integration is not set up" | Set up HA's LG webOS TV integration and make sure the TV is paired. |
| PIP shows "Not set up yet" | Enter the URL and token in the integration and press **Send connection to TV**, or use the TV setup screen. |
| "Authentication failed" | The token was deleted or mistyped. Create a new one. |
| Black box, spinner forever | Try `mode: snapshot`. Check that the TV can reach the HA URL (not `homeassistant.local` unless the TV resolves it). |
| App vanished from the TV | The Developer Mode session expired. Extend it and reinstall the app. |
| `ares-novacom --getkey` fails | Turn **Key Server** on in the Developer Mode app. |

## Development

```bash
# TV app: run against a fake Home Assistant in a desktop browser
cd webos-app && npm install
npm run mock                  # then open http://localhost:8124/tv.html
                              #   ?camera=camera.garden&mode=hls  -> PIP
                              #   (no params)                     -> setup screen
npm run install-tv            # build, package and install on the TV registered as "tv"
npm run inspect               # Chrome DevTools for the app on the TV
cp .env.example .env          # optional: bake defaults into your own build (never publish it)

# Integration
python3 -m venv .venv && .venv/bin/pip install -r requirements_test.txt
.venv/bin/pytest
python3 scripts/gen_translations.py   # after editing strings.json
```

Releases: publishing a GitHub release builds the IPK, with the version taken from the tag, and attaches it to the release.

## License

MIT
