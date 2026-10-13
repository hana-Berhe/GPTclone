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
