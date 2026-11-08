# Modifications — tixelcat

Original project: [ISDaddy/ha-lg-webos-pip](https://github.com/ISDaddy/ha-lg-webos-pip), © 2026 ISDaddy, MIT License. Modifications by [tixelcat](https://github.com/tixelcat) in 2026; this is an unofficial community fork.

## TV application 1.0.4

- Improved overlay lifecycle and reliable close/relaunch, cleanup and remote-control recovery.
- Improved MJPEG media cleanup, suppressed launch splash/loading spinner.
- Added best-effort screensaver wake when a camera notification appears, with a Homebrew privileged service path on rooted TVs, two short retries, cancellation on close, and standard webOS fallback.
- Kept internal app ID `io.github.isdaddy.lgwebospip` and original license/attribution.

## TV application 1.0.5

- Added updated Home Assistant PIP icons.
- Reduced MJPEG first-frame polling from 100 ms to 50 ms without experimental animations or reconnect changes.
- Preserved stable overlay and remote-control behavior confirmed during repeated user tests.
- Updated direct Home Assistant `webostv.command` examples and installation documentation.

## TV application 1.0.6

- Added two independent camera windows and two independent media players sharing one Home Assistant connection.
- Preserved the existing HA URL, token, connection test and camera discovery flow.
- Added an On/Off switch for each saved camera; sources and positions are retained while disabled. Both Off exits without displaying a saved PIP.
- Four corners per camera with prevention of duplicate active corner assignments.
- Camera sizes restricted to 10%, 20%, 30%, 40%, 50% of screen width; same percentage yields equal-size 16:9 dual windows, with contained streams preserving their source aspect ratios.
- Reorganized the TV setup menu: HA configuration above, two camera columns side by side, Save/Preview/Exit below.
- Added `show_saved: true` launch handling that reads settings stored in the TV app, including close-after timeout; no camera/size/position/timeout fields required in HA.
- Added optional `title` handling for a saved-layout launch (displayed on the first active camera).
- Preserved explicit `camera:` launches and the original TV app ID `io.github.isdaddy.lgwebospip` for existing automations.
- Tested the above changes on a real LG TV; see [README.md](README.md) for scope and limitations.

## Compatibility and licensing

Features beyond the original project may behave differently across webOS generations and firmware. Root-dependent screensaver wake requires compatible Homebrew services. All upstream license and copyright notices must remain; no official affiliation with LG or Home Assistant is implied.
