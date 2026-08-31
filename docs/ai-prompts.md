# AI Prompts Log

Keeping track of what I asked the AI to build for each task, what it came back with, and what I
ended up having to fix or push back on. This isn't a list of code changes — that's what
`plan.md` and `decisions.md` are for. This is just the "here's how the conversation actually went."

---

## Task 1 — Getting set up, database, login system

### What I asked for

I gave it the overall project — a restaurant order system replacing paper tickets, with managers
who own the menu and waiters who run orders — along with the tech I wanted to use and told it not
to swap anything out without asking me first: React + Vite + Tailwind + React Router + TanStack
Query on the frontend, Node + Express on the backend, Postgres through Supabase using Prisma (and
nothing else), and a login system built by hand with bcrypt for passwords and a JWT stored in a
cookie the browser's JavaScript can't touch. Role checks (manager vs waiter) had to happen on the
server, not just hidden/shown in the UI.

For this specific task, I told it this was task 1 of 10 and not to touch anything beyond:
1. Setting up the client and server folders, with a proper structure, and a `.gitignore`.
2. Setting up Prisma and a User table (name, email, password, role, created date), running the
   actual migration, and making sure there's one shared database connection instead of creating a
   new one all over the place.
3. Building the login API — register, login, logout, "who am I," and the two pieces of middleware
   every future feature is going to depend on: one that checks you're logged in, one that checks
   you're the right role.
4. Building the actual login/register pages, plus something that keeps track of who's logged in
   across the app, redirects you if you're not logged in, and a nav bar with an empty
   dashboard page.
5. Making it look decent with Tailwind — nothing fancy, just clean.

I also told it: ask me before installing anything or running a migration against the real database,
don't build anything beyond this list, and actually prove it works — register a manager and a
waiter, log in as both, check that "who am I" returns the right role, and check that a logged-out
person gets rejected — and show me the real output, not just tell me it works.

### What it came back with

Everything on the list got built. It actually registered both accounts, logged in as each one,
checked the role came back right, checked that logging out clears the session, and checked that a
logged-out request gets rejected — all through real requests, not just claiming it works. It also
opened an actual browser and clicked through the login page, the register page, logging out, and
getting redirected when trying to visit pages you're not supposed to see — so I could see it
actually working, not just the API responding.

### What I had to catch or fix along the way

- Setting up Prisma quietly installed a not-yet-released version instead of the stable one. It
  caught this itself, flagged it to me, and I told it to switch to the stable version.
- That same setup step dumped a bunch of AI-tool config folders into the project that had nothing
  to do with the actual app. Also caught, also removed after I said yes.
- Turned out the version of Prisma we ended up on needs an extra package just to actually connect to
  the database — it flagged this too and I approved adding it.
- It also had to switch the whole server over to the newer import/export style of writing
  JavaScript, because the code Prisma generates only works that way.
- When I first pasted in my real database password, it had an `@` symbol in it that broke the
  connection string, plus I'd accidentally pasted an extra line by mistake. I cleaned up the stray
  line myself and asked it to fix the `@` symbol issue.
- Even after fixing that, the first attempt still failed to connect — turned out my password itself
  was just wrong/outdated, not a formatting issue. Once I double-checked it in Supabase, it worked.


