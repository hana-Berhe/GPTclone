<!--
Demo conversations used by `npm run db:seed`.

Format:
  @@@ chat | <title> | <days ago> | <hours ago>
  @@@ user
  ...message...
  @@@ assistant
  ...message (Markdown)...

"days ago" decides the sidebar group: 0 = Today, 1 = Yesterday, 2-7 = Previous 7 days,
8-30 = Previous 30 days, older = month name. "hours ago" orders chats within a day
(counted from now for today, otherwise from the end of that day).
List chats from newest to oldest. Edit freely, then run `npm run db:seed` again.
-->

@@@ chat | React useEffect cleanup | 0 | 1
@@@ user
When does the cleanup function in useEffect run? I keep getting a warning about updating state on an unmounted component.
@@@ assistant
The cleanup function runs in two situations:

1. **Before the effect runs again**, when one of its dependencies changes.
2. **When the component unmounts**, i.e. it's removed from the screen.

Your warning usually means a request finished *after* the component was gone, and then called `setState`. The fix is to cancel the request in the cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then((res) => res.json())
    .then(setUser)
    .catch((error) => {
      if (error.name !== "AbortError") setError(error);
    });

  return () => controller.abort();
}, [userId]);
```

Now, if `userId` changes or the component unmounts, the old request is cancelled and can't update state.

> **Tip:** In development, React's `StrictMode` runs every effect twice on purpose. If your cleanup is correct, you won't notice anything except a cancelled request in the Network tab.
@@@ user
Does the same apply to setInterval?
@@@ assistant
Yes. Any timer, subscription or event listener you start in an effect should be stopped in its cleanup:

```jsx
useEffect(() => {
  const id = setInterval(() => {
    setSeconds((s) => s + 1);
  }, 1000);

  return () => clearInterval(id);
}, []);
```

Two details make this work:

- `clearInterval(id)` stops the timer when the component unmounts.
- `setSeconds((s) => s + 1)` uses the **updater form**, so the effect doesn't need `seconds` as a dependency and the interval isn't restarted every second.

@@@ chat | 3-day itinerary for Addis Ababa | 0 | 4
@@@ user
Plan a relaxed 3-day trip to Addis Ababa for someone visiting for the first time.
@@@ assistant
Here's a relaxed plan that mixes history, food and green space.

## Day 1: History and the city center

- **Morning:** National Museum of Ethiopia, home of the famous *Lucy (Dinknesh)* fossil exhibit.
- **Lunch:** Try *shiro* and *injera* at a local restaurant nearby.
- **Afternoon:** Holy Trinity Cathedral, with its stained glass and the tomb of Emperor Haile Selassie.
- **Evening:** A traditional coffee ceremony. Ask your hotel where to find one.

## Day 2: Parks and views

- **Morning:** Unity Park, in the grounds of the National Palace.
- **Afternoon:** Drive up to Entoto Park for forest walks and views over the city.
- **Evening:** Dinner with live music at a cultural restaurant.

## Day 3: Markets and museums

- **Morning:** Merkato, one of the largest open-air markets in Africa. Go with a guide and keep valuables close.
- **Afternoon:** The Ethnological Museum at Addis Ababa University.
- **Before you leave:** Pick up freshly roasted Ethiopian coffee to take home.

**Practical tips**

| Topic | Advice |
| --- | --- |
| Getting around | Use ride-hailing apps or a trusted driver |
| Altitude | The city is about 2,355 m high, so take it easy on day 1 |
| Weather | Bring a light jacket: evenings can be cool |

@@@ chat | SQL: top customers by revenue | 1 | 3
@@@ user
I have `customers` and `orders` tables. How do I get the top 5 customers by total spending?
@@@ assistant
Join the two tables, add up each customer's orders, then sort:

```sql
SELECT
  c.id,
  c.name,
  COUNT(o.id)   AS order_count,
  SUM(o.total)  AS total_spent
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY total_spent DESC
LIMIT 5;
```

Example result:

| id | name | order_count | total_spent |
| --- | --- | --- | --- |
| 42 | Selam T. | 18 | 2,940.50 |
| 17 | Daniel K. | 12 | 2,315.00 |
| 8 | Marta A. | 15 | 1,980.75 |
| 63 | Yonas B. | 9 | 1,742.20 |
| 25 | Liya M. | 11 | 1,655.90 |

A few notes:

- `WHERE o.status = 'paid'` skips cancelled orders. Remove it if you don't have a status column.
- To include customers with **no** orders, use `LEFT JOIN` and `COALESCE(SUM(o.total), 0)`.
- An index on `orders (customer_id)` keeps this fast on large tables.

@@@ chat | Fix CORS error in Express | 1 | 7
@@@ user
My React app on localhost:5173 gets "blocked by CORS policy" when calling my Express API on port 3000. How do I fix it?
@@@ assistant
The browser blocks requests to a different origin (port 5173 → 3000) unless the server explicitly allows it. Install the `cors` package and allow your frontend's origin:

```js
import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // only if you send cookies
  }),
);

app.use(express.json());
```

Put `app.use(cors(...))` **before** your routes, so it also answers the browser's preflight `OPTIONS` request.

**Even simpler in development:** let Vite forward API calls so there is no cross-origin request at all:

```js
// vite.config.js
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
});
```

Then call `fetch("/api/...")` from React, without the `http://localhost:3000` part.

@@@ chat | Python script to rename photos by date | 3 | 2
@@@ user
Write a Python script that renames all .jpg files in a folder to the date they were last modified, like 2026-10-13_001.jpg.
@@@ assistant
Here's a safe version with a **dry run** by default, so you can check the new names first:

```python
from datetime import datetime
from pathlib import Path
import sys


def rename_photos(folder: Path, apply: bool = False) -> None:
    photos = sorted(folder.glob("*.jpg"), key=lambda p: p.stat().st_mtime)
    counters: dict[str, int] = {}

    for photo in photos:
        day = datetime.fromtimestamp(photo.stat().st_mtime).strftime("%Y-%m-%d")
        counters[day] = counters.get(day, 0) + 1
        new_name = f"{day}_{counters[day]:03d}.jpg"
        target = photo.with_name(new_name)

        print(f"{photo.name}  ->  {new_name}")
        if apply and not target.exists():
            photo.rename(target)


if __name__ == "__main__":
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    rename_photos(folder, apply="--apply" in sys.argv)
```

Usage:

```bash
python rename_photos.py ~/Pictures/trip          # preview only
python rename_photos.py ~/Pictures/trip --apply  # actually rename
```

Photos from the same day are numbered in the order they were taken, and existing files are never overwritten.

@@@ chat | REST vs GraphQL | 4 | 5
@@@ user
What's the difference between REST and GraphQL? When should I use each?
@@@ assistant
Both let a client get data from a server; they differ in **who decides the shape of the response**.

| | REST | GraphQL |
| --- | --- | --- |
| Endpoints | Many (`/users`, `/users/1/posts`) | One (`/graphql`) |
| Response shape | Decided by the server | Decided by the client's query |
| Over-fetching | Common | Avoided |
| Caching | Easy with HTTP caching | Needs extra tooling |
| Learning curve | Low | Medium |
| File uploads | Simple | Needs extensions |

**A GraphQL query** asks for exactly the fields it needs:

```graphql
query {
  user(id: 1) {
    name
    posts(last: 3) {
      title
    }
  }
}
```

**Choose REST** for simple CRUD APIs, public APIs, and when HTTP caching matters.

**Choose GraphQL** when many different screens need different slices of related data, or when mobile clients need to minimize requests.

For most small and medium projects, REST is the simpler place to start.

@@@ chat | Quick healthy breakfast ideas | 6 | 1
@@@ user
Give me some quick breakfast ideas for busy weekday mornings.
@@@ assistant
Here are options that take 10 minutes or less:

**Make-ahead (prepare the night before)**
- **Overnight oats:** oats, milk or yogurt, chia seeds and fruit in a jar.
- **Egg muffins:** whisked eggs with spinach and peppers, baked in a muffin tin. Keeps for 3 to 4 days.

**Under 5 minutes**
- **Greek yogurt bowl** with berries, nuts and a little honey.
- **Peanut butter toast** on whole-grain bread with banana slices.
- **Smoothie:** frozen fruit, spinach, yogurt and milk, blended.

**Under 10 minutes**
- **Scrambled eggs** with tomato and whole-grain toast.
- **Ful medames**, if you have cooked fava beans ready: warm with olive oil, cumin and lemon.

Batch-preparing two of these on Sunday makes the whole week easier.

@@@ chat | Cover letter opening for a junior developer role | 12 | 2
@@@ user
Help me write a strong opening paragraph for a cover letter. I'm applying for a junior full-stack developer role and I recently built a ChatGPT clone with React and Express.
@@@ assistant
Here's an opening that leads with your project, since that's your strongest proof of skill:

> Dear Hiring Team,
>
> I recently built and deployed a full-stack ChatGPT clone, with streaming AI responses, user accounts and a MySQL database, using React and Express. Taking it from idea to a live, tested application taught me how much I enjoy solving problems across the whole stack, and that's exactly what excites me about the Junior Full-Stack Developer role at [Company].

**Why this works**

- It opens with **something you've done**, not a generic statement like "I am writing to apply".
- It names **concrete skills** the job ad likely mentions: React, Express, databases, deployment.
- It connects your experience to **their** role in the last sentence.

Next, add a paragraph about one technical challenge you solved, and a link to the live project and GitHub repo.

@@@ chat | Git rebase vs merge | 20 | 6
@@@ user
What's the difference between git rebase and git merge?
@@@ assistant
Both bring changes from one branch into another, but they record history differently.

**Merge** keeps both histories and adds a merge commit:

```bash
git checkout feature
git merge main
```

**Rebase** replays your commits on top of the latest `main`, giving a straight line of history:

```bash
git checkout feature
git rebase main
```

| | Merge | Rebase |
| --- | --- | --- |
| History | Branching, with merge commits | Linear and clean |
| Rewrites commits | No | Yes (new commit IDs) |
| Safe on shared branches | Yes | No |

**The golden rule:** never rebase commits that others have already pulled. Rebase your own local feature branch to tidy it up, then merge it (or open a pull request).

If a rebase goes wrong, you can always undo it:

```bash
git rebase --abort
```

@@@ chat | Big O notation basics | 45 | 3
@@@ user
Can you explain Big O notation simply?
@@@ assistant
Big O describes **how the running time of an algorithm grows** as the input gets bigger. It ignores small details and focuses on the trend.

| Big O | Name | Example | 1,000 items → steps |
| --- | --- | --- | --- |
| O(1) | Constant | Read `list[0]` | 1 |
| O(log n) | Logarithmic | Binary search | ~10 |
| O(n) | Linear | Loop over a list | 1,000 |
| O(n log n) | Linearithmic | Efficient sorting | ~10,000 |
| O(n²) | Quadratic | Nested loops | 1,000,000 |

Compare two ways to check for duplicates:

```python
# O(n²): compares every pair
def has_duplicates_slow(items):
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                return True
    return False


# O(n): remembers what it has seen
def has_duplicates_fast(items):
    seen = set()
    for item in items:
        if item in seen:
            return True
        seen.add(item)
    return False
```

With 100,000 items, the first version may take minutes; the second finishes almost instantly.
