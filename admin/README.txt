Netlify + Decap CMS setup

1. Push this project to GitHub.
2. In Netlify create a new site from that GitHub repository.
3. In Netlify enable Identity.
4. Under Identity registration choose Invite only or Open.
5. Under Identity services enable Git Gateway.
6. Open /admin on the deployed site.
7. Invite yourself from Netlify Identity if registration is Invite only.

Notes:
- The CMS backend is already set to git-gateway.
- Content is stored in content/posts.json.
- Uploaded media goes to uploads/.
- local_backend: true remains enabled for local editing with `npx decap-server`.
