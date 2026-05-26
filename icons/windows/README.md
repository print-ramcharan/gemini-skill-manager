Windows icon notes
------------------

Place a `icon.ico` at `icons/windows/icon.ico` before running `npm run build:win`.

Create from a PNG using ImageMagick:

```bash
convert colorful-padded.png -define icon:auto-resize=256,128,64,48,32,16 icons/windows/icon.ico
```

Or generate `.ico` with other icon tools (icns2png, online generators, etc.).

Recommended sizes included: 16, 32, 48, 64, 128, 256.

If you want, I can generate `icon.ico` from the current `colorful-padded.png` and add it.
