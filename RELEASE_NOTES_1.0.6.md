# Home Assistant PIP 1.0.6 — tixelcat

**Dual-camera saved layouts, tested on a real LG TV.**

## What's new

- Show **two cameras simultaneously**, configured independently in the LG TV settings.
- Select camera sources from the existing Home Assistant camera discovery list, without changing the HA connection, token or connection test.
- Use separate **Show camera: On/Off** controls; disable either camera or both without losing saved settings.
- Choose among **four corners**, with occupied corners excluded for the other enabled camera.
- Choose **10%, 20%, 30%, 40%, 50%** width independently. Matching settings now produce matching 16:9 outer window dimensions, even for streams with different aspect ratios.
- Wide, two-column TV menu: HA settings above; **Save / Preview / Exit** below.
- Start the saved cameras using the minimal, user-tested Home Assistant command:

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

No `timeout`, `size` or `position` is required: **the TV settings control these**. Optional `title` is supported, e.g. for a doorbell notification. Existing single-camera `camera:` actions still work.

## Installation

Download `io.github.tixelcat.lgwebospip_1.0.6_all.ipk` from **Assets** below, then follow [INSTALLATION.md](https://github.com/tixelcat/ha-lg-webos-pip/blob/main/INSTALLATION.md).

**Important:** the IPK filename uses `tixelcat`, while the *internal* app ID remains **`io.github.isdaddy.lgwebospip`**. This is deliberate for compatibility; no app ID migration is necessary.

## Verification

- Installed and user-tested on a real LG webOS TV: two simultaneous camera overlays, configuration and switches, equal windows, saved-layout action, title, and legacy compatibility.
- The IPK contains `window.HA_CONFIG = {};`, not an embedded Home Assistant token.
- **IPK size:** 213,836 bytes.
- **SHA-256:** `17C7647E02E6627AB840FBF4D810ECBE1AD57521A041F0A40A27F0078A43C5CA`.

## Scope / limitations

One tested rooted LG TV; operation on other models, firmware versions, unrooted TVs or protected video services can vary. MJPEG is recommended above playing television. Rooted Homebrew screensaver wake remains best effort. The optional custom Home Assistant `lg_webos_pip` integration is not needed for the recommended `webostv.command` action.

## Credits

Based on the original MIT-licensed work by [ISDaddy](https://github.com/ISDaddy/ha-lg-webos-pip). Enhanced fork by [tixelcat](https://github.com/tixelcat); original copyright and license notices retained.
