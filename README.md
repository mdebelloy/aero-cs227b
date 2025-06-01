# README — Running **`run_tournament.js`**

This guide explains **exactly** how we can run the Puppeteer tournament harness, watch what it’s doing, and modify it safely.
Everything below is specific to the *Stanford GameMaster* site at

```
http://gamemaster.stanford.edu/homepage/
```

---

## 0  Prerequisites

| Requirement                  | Version / notes                                                     |
| ---------------------------- | ------------------------------------------------------------------- |
| **Node .js**                 | ≥ 18 (we develop on 20.19)                                          |
| **npm**                      | comes with Node                                                     |
| **Google-Chrome / Chromium** | not required – Puppeteer bundles its own                            |
| **Linux / macOS**            | script is OS-agnostic; the `--no-sandbox` flag lets it run on macOS |

Install dependencies once:

```bash
npm install
```

`package.json` only needs:

```json
{
  "dependencies": {
    "puppeteer": "^22.8.2"
  }
}
```


## 1  The one command to run

```bash
node run_tournament.js
```

> **Heads-up:** the script intentionally launches **Chrome in visible (headful) mode** so we can watch it step through the site.

---

## 2  What happens, step-by-step

| Phase                      | What you’ll see                                                                                                                                                                    | What the code is doing                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Launch browser**         | A Chrome window appears listening on DevTools port; console prints “🛫 Opening GameMaster…”                                                                                        | `puppeteer.launch({ headless:false … })`                                                                     |
| **Navigate to login form** | Browser loads `http://gamemaster.stanford.edu/homepage/signin.php`<br>*(If Chrome silently rewrites to **https** you will land on a 404)*                                          | `page.goto(LOGIN_URL …)`                                                                                     |
| **Manual login**           | Terminal prints the blue block of instructions headed **“MANUAL LOGIN REQUIRED”**.                                                                                                 | Script pauses, polling every 2 s (`page.evaluate`) until we are past the login page.                         |
| **Dashboard detected**     | Console prints “✅ Login detected!” plus the current URL and first few links.                                                                                                       | `page.waitForFunction(…uploadplayer…run.php…)`                                                               |
| **Upload check / upload**  | Script goes to `/homepage/profile.php`.  *If the player already exists, it skips upload.*<br>Otherwise you’ll see it fill the file chooser → password box → click *Upload Player*. | Uses the plain HTML form:<br>`input[type=file][name=file]`<br>`input[name=password]`<br>`input[type=submit]` |
| **Open three tabs**        | Three tabs pop up: `aero.html`, `zj.html`, and the **manager.php** for TicTacToe3.                                                                                                 | URLs are hard-coded at top of the file.                                                                      |
| **Ping & run matches**     | In manager window you’ll see “Ping” then repeated “Run”. Scores update each game.                                                                                                  | Script waits for numeric cells in the manager table, tallies win/draw/loss.                                  |
| **Summary & results file** | After 10 games (5 as X, 5 as O) the console prints a table and writes `tournament_results.json` in cwd.                                                                            | JSON schema: `{game, opponent, totalGames, results, timestamp}`                                              |
| **Idle**                   | Chrome stays open; we can inspect anything.  `Ctrl+C` twice to quit.                                                                                                               | The script parks on `await new Promise(()=>{})` so nothing closes automatically.                             |

---

## 3  Key constants (all at top of file)

```js
// Site endpoints – mutable if Stanford reorganises URLs
const BASE = 'http://gamemaster.stanford.edu/homepage';
const LOGIN_URL  = `${BASE}/signin.php`;
const UPLOAD_URL = `${BASE}/uploadplayer.php`;
const RUN_URL    = `${BASE}/run.php`;

// Our credentials & assets
const PLAYER_CODE     = 'aero';
const PLAYER_PASSWORD = '460264';
const AERO_FILE       = './aero_final.html';

// Tournament parameters
const GAME            = 'TicTacToe3';
const OPPONENT        = 'zj';
const RUNS_PER_ROLE   = 5;          // 5 as X + 5 as O
```

Change **`OPPONENT`**, **`GAME`**, or **`RUNS_PER_ROLE`** to run different brackets.
If Stanford ever moves pages out of `/homepage/`, update `BASE` and the three endpoint constants.

---

## 4  Why manual login is required

* Chrome ≥ 120 silently upgrades every *public* HTTP navigation to HTTPS (HSTS “HTTPS-First”).
* `https://gamemaster.stanford.edu/homepage/signin.php` returns **404**.
* The site sets its session cookie only on **HTTP**.
* Disabling the auto-upgrade via `--disable-features=UpgradeInsecureRequests` *usually* works, but a few lab machines still auto-redirect.
* The script therefore prints instructions and waits for us to complete login once per run.

> If you prefer fully-headless operation, run Chrome with the flag above **and** clear any HSTS entry for `gamemaster.stanford.edu` (`chrome://net-internals/#hsts`).
> We opted for the safer manual flow so every teammate can run it on any machine.

---

## 5  Selectors the script relies on

| Page           | Selector                                            | Purpose                          |
| -------------- | --------------------------------------------------- | -------------------------------- |
| `signin.php`   | `input[name="username"]` / `input[name="password"]` | Manual login (we type)           |
| `profile.php`  | `input[type=file][name=file]`                       | Upload our HTML                  |
|                | `input[name="password"]`                            | Confirm pw for upload            |
| `run.php`      | `select[name="game"]`                               | Choose game                      |
|                | `select[name="opponent"]`                           | Choose opponent                  |
|                | `input[name="roleX"][value="aero"]` (or roleO)      | Role radio buttons               |
| Manager window | `input[value="Ping"]` / `input[value="Run"]`        | Start matches                    |
| Manager table  | first two `<td>` containing only digits             | Extract scores                   |
| Match viewer   | `#transcript`                                       | Contains `(goal X n) (goal O n)` |

All of these are static on the current site (May 2025).

---

## 6  Troubleshooting checklist

| Symptom                                                       | Likely cause                          | Fix                                                                         |
| ------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| **404 immediately after launch**                              | Browser upgraded to HTTPS             | Manually change URL to `http://…` or add the flag (see § 4).                |
| **`Timeout waiting for selector input[type=file]`** on upload | We’re not on `profile.php`            | Check that `profile.php` still contains the upload form.                    |
| **Ping returns “anonymous not ready”**                        | Manager table still shows “anonymous” | Wait a second; the script auto-fills but can be slow on campus Wi-Fi.       |
| **Match never finishes**                                      | Opponent player locked up             | Close popup, press Run again; script will time out after 60 s and continue. |
| **JSON file not written**                                     | Process crashed                       | Read console; fix selector / network.                                       |

---

## 7  Modifying or extending

1. **Different game**
   *Change `GAME = 'TicTacToe5'`* and adjust the manager URL if you hard-code it.
2. **Multiple opponents**
   Change `OPPONENT` to an array and loop in `runTournament`.
3. **More games**
   Increase `RUNS_PER_ROLE`.
4. **Headless batch mode**
   Set `headless:true` and supply your own Chrome flags as noted.

---

## 8  File map

| File                          | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| **`run_tournament.js`**       | Main driver (login → upload → tournament → summary)                   |
| **`aero_final.html`**         | Our GGP player                                                        |
| **`tournament_results.json`** | Auto-generated summary (overwritten each run)                         |
| **`debug_login.html`**        | Snapshot of whatever the login request returned (useful if it breaks) |

