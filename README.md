# DNS Manager

This is the DNS Manager UI used by the main site's `/mtools/dns-manager` route. It is also a standalone Vite app.

## Run standalone

```sh
cd external_tools/dns
bun install
bun run dev
```

Open `http://localhost:5173/`. On first use, enter the DNS API endpoint and API token. Both are stored in that origin's browser storage. No API host is preset. The API must permit requests from the origin where this UI is served.

You can enter a host without a protocol. The app checks `/api/health` over HTTPS first, then HTTP, without sending the token. It stores the first working URL and then verifies the token. If neither protocol connects, it shows an error toast. An explicit `https://` or `http://` URL uses only that protocol.

The standalone entry enables the DNS Manager's theme and language buttons. Those choices are stored under `dns-manager-theme` and `dns-manager-locale` in browser storage.

`bun run typecheck` checks TypeScript. `bun run build` creates a static Vite deployment in `dist/`. To serve it under a path prefix, set `VITE_BASE_PATH` to that path (including a trailing slash) when building and configure the host to serve `index.html` for deep links.

## Main site integration

The main site's `/mtools/dns-manager` route imports `src/App.tsx` through `DnsManagerHost.tsx`. The host passes its MUI theme and locale, and hides the DNS Manager's own switch buttons because the main site has its own. The `/mtools` card links to that route. The main site's health card reads the configured endpoint from the shared API module. Because browser storage is scoped to an origin, a separately hosted Vite deployment asks for its own endpoint and token.

`DnsManagerApp` accepts these integration props:

| Prop | Purpose |
| --- | --- |
| `path`, `basePath` | Current route and URL prefix used when embedded. |
| `enable_theme_switch_button` | Show the DNS Manager's theme button. |
| `theme_data` | `{ mode: "light" \| "dark", theme?: MuiTheme, onChange?: (mode) => void }` from the host. |
| `enable_i18n_switch_button` | Show the DNS Manager's language button. |
| `i18n_data` | `{ locale: "en" \| "zh", messages?: Partial<DnsMessages>, onChange?: (locale) => void }` from the host. |

When a host supplies a `theme` object, it is used directly. `messages` overrides individual built-in English or Chinese strings. Pass `onChange` if the DNS Manager's own switch buttons are enabled while embedding it. The root Bun workspace shares React and MUI dependencies between the host and this package.
