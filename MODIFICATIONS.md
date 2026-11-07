# Modifications — tixelcat

Original project: [ISDaddy/ha-lg-webos-pip](https://github.com/ISDaddy/ha-lg-webos-pip) — MIT License, Copyright (c) 2026 ISDaddy.

Modified by **tixelcat** in 2026. These changes are not an official release of the original project.

## TV application (1.0.4)
- Better overlay lifecycle, close/relaunch cleanup and MJPEG media handling (based on previous 1.0.1 changes).
- Suppress splash/spinner during overlay launch.
- Attempt to wake a screensaver before showing camera using the privileged Homebrew Channel service on rooted TVs; retry after 450 and 1300 ms; cancel pending retries when closing.
- Fallback attempt to call the standard webOS tvpower service when the privileged call fails.
- Set visible app name to **Home Assistant PIP**. Keep original application ID and integration compatibility.

## Compatibility
- Rooted Homebrew TV: root wake approach tested by the modifier on one TV.
- Non-root Developer Mode TV: overlay is supported upstream, but root wake cannot work; direct fallback is best-effort, not proven to dismiss the screensaver.
- Keep Home Assistant integration from upstream unchanged. No guarantee of interoperability on all firmware.

## License
Retain original MIT license and copyright ISDaddy. Modified portions attributed to tixelcat.
