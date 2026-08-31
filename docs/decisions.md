# Decisions

This is a log of the actual choices I made along the way, where more than one option made sense and
I had to pick one. Not everything I did during the build, just the stuff worth remembering why later.
Numbers keep going up across tasks — I won't renumber old ones, I'll just add a "Later reversed"
note under one if I end up changing my mind down the line.

---

1. Went with the stable version of Prisma instead of what got installed by default

When I ran `prisma init`, it quietly installed a release-candidate version of Prisma (8.0.0-rc.12)
that didn't even match the client library version it also installed. I switched both back to the
plain stable version, 7.10.0.


---

2. Deleted the AI-assistant folders that Prisma auto-created

Setting up Prisma also dropped a bunch of folders into the project — `.claude`, `.cursor`,
`.agents`, `.devin` — plus a script that runs every time you install packages. I deleted all of it.


---

3. Had to add an extra package just to let Prisma connect to the database

Turns out the new version of Prisma doesn't let you just point it at a database URL anymore — you
have to give it an actual "adapter" package to make the connection. I added `@prisma/adapter-pg`
along with the regular `pg` package for this.


---
4. Switched the server to use `import`/`export` instead of `require`

Node projects usually default to the older `require()` style. I switched the server over to the
newer `import`/`export` style instead.


---

5. Registering doesn't log you in automatically

After you fill out the register form, it just takes you to the login page — it doesn't sign you in
right away. You have to type your new password in and log in like normal.



