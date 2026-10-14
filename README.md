# ChatGPT Clone

React + Vite frontend, Express 5 + MySQL backend, Google Gemini for answers.

**Features:** sign up / log in, separate chats per user, chat history in the sidebar
(grouped by date, searchable, rename, delete), answers that stream in word by word,
a Stop button, auto-generated chat titles, Markdown with tables and highlighted code
blocks (with Copy), copy buttons on messages, a URL per chat (`/c/12`) that survives
refresh and works with back/forward, Ctrl+Shift+O for a new chat, mobile layout,
and light/dark mode following your system setting.

## 1. Database

Create an empty MySQL database. The server creates the tables itself on startup.

```bash
mysql -u root -p -e "CREATE DATABASE chatgpt_clone CHARACTER SET utf8mb4"
```

(The old `conversations` table is no longer used. You can drop it.)

## 2. Backend

```bash
cd backEnd
cp .env.example .env      # then fill in the values
npm install
npm run dev               # http://localhost:3000
```

Required in `.env`: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `GEMINI_API_KEY`,
and `JWT_SECRET` (32+ characters). Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server checks these on startup, creates any missing tables, and tells you exactly what's wrong.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

In development, Vite forwards `/api` to `localhost:3000`, so no extra config is needed.

## API

| Method | Path                | Description                                      |
| ------ | ------------------- | ------------------------------------------------ |
| POST   | `/api/auth/register`| `{ name, email, password }` → `{ user, token }`  |
| POST   | `/api/auth/login`   | `{ email, password }` → `{ user, token }`        |
| GET    | `/api/auth/me`      | Current user                                     |
| GET    | `/api/chats`        | The user's chats, newest first                   |
| GET    | `/api/chats/:id`    | One chat with its messages                       |
| PATCH  | `/api/chats/:id`    | `{ title }` rename                               |
| DELETE | `/api/chats/:id`    | Delete a chat and its messages                   |
| POST   | `/api/chats/stream` | `{ chatId?, question }`, streams Server-Sent Events: `meta`, `delta`, `done`, `title`, `error` |

All `/api/chats` routes need `Authorization: Bearer <token>`.

Invalid input returns `400` with one message per field:

```json
{
  "status": "error",
  "message": "Please enter a valid email address.",
  "errors": { "email": "Please enter a valid email address.", "password": "Password must be at least 8 characters." }
}
```

## Project structure (backend)

Each feature follows the same layers:

```
src/api/<feature>/
  routes/       URL -> middleware -> controller
  validation/   express-validator rules (shape of the input)
  controller/   reads req.validated, sends the response
  service/      business rules that need the database (ownership, duplicates)
  model/        SQL queries
```

`src/middleware/validate.js` runs the rules and puts the cleaned values on `req.validated`.
Fields without a rule are dropped, so unexpected input never reaches a service.

## How a message flows

1. React sends `POST /api/chats/stream` (no `chatId` means "start a new chat").
2. The service validates the question, finds (or creates) the chat, loads the last 20 messages of that chat, and saves the question.
3. Gemini streams the answer; each piece is forwarded to the browser as a `delta` event.
4. The full answer is saved and a `done` event is sent. For new chats, Gemini then writes a short title (`title` event).
5. If the user presses Stop, whatever was generated so far is saved, like ChatGPT does.

## Production

From the project root:

```bash
npm run build   # installs everything and builds the React app into frontend/dist
npm start       # Express serves the API and the React app on one port
```

Built in for running publicly:

- **Rate limits:** 20 sign-up/login attempts per IP per 15 minutes, and 15 messages per account
  per minute (`RATE_LIMIT_*` variables). Counters are kept in memory, which suits one instance.
- **Security headers:** Content-Security-Policy, HSTS (production only), no framing, and more
  (`src/middleware/security-headers.js`).
- **Clean shutdown:** on redeploy, running requests finish before the database closes.
- **Health check:** `GET /api/health`.

## Deploying (Render + Aiven MySQL)

1. **Database (Aiven):** in your MySQL service, open *Databases* and create `chatgpt_clone`.
   From the *Overview* page, note the host, port, user and password, and download the
   *CA certificate*. Test locally first: save it as `backEnd/ca.pem`, set the `DB_*` values
   plus `DB_SSL=true` and `DB_SSL_CA_FILE=./ca.pem` in `backEnd/.env`, then run
   `npm run db:check` in `backEnd`.
2. **App (Render):** *New > Blueprint*, choose this repository. Render reads `render.yaml`
   and asks for the secret values:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (`chatgpt_clone`)
   - `DB_SSL_CA`: open `ca.pem` and paste its entire contents
   - `GEMINI_API_KEY`, `GEMINI_MODEL`

   `JWT_SECRET` is generated by Render automatically.
3. Wait for `Server is running` in the logs, then open the `onrender.com` link.

Every push to `main` redeploys automatically. Never commit `.env` files or `*.pem`
certificates; `.gitignore` already excludes them.

## Demo data (for screenshots)

```bash
cd backEnd
npm run db:seed
```

Creates two demo accounts with realistic conversations (code, tables, lists) spread across
Today, Yesterday, Previous 7 days, Previous 30 days and an older month:

| Account | Email | Chats |
| --- | --- | --- |
| Hana Berhe | `hana@example.com` | 10 |
| Abebe Kebede | `abebe@example.com` | 2 |

The password is `Demo1234!` (or set your own: `SEED_PASSWORD=YourPassword npm run db:seed`).
Run it again any time to reset the demo chats; real users are never touched. The
conversations live in `backEnd/db/seed-data.md`, so you can edit them freely.

Run it from your computer: the chats are placed on calendar days in your time zone.
To seed the deployed app, point `backEnd/.env` at the production database (Aiven) first.

## Tests

```bash
cd backEnd
npm test
```

The tests start the real Express app with an in-memory SQLite database and a fake
Gemini model (see `test/support/`), so they need no MySQL, API key or internet.
They cover sign-up/login, every validation rule, streaming, Stop, chat ownership,
and rename/delete.

## Code formatting

[Prettier](https://prettier.io) keeps the code style identical in both folders.
The settings live in `.prettierrc.json` at the project root.

```bash
npm run format          # from the root: formats backEnd and frontend
npm run format:check    # fails if any file isn't formatted (useful in CI)
```

In VS Code, install the recommended extensions when prompted (Prettier, ESLint,
EditorConfig). Files are then formatted automatically every time you save.
