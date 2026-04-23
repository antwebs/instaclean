Decap CMS setup

1. Put this project in a GitHub repository.
2. In admin/config.yml replace REPLACE_WITH_YOUR_GITHUB_USERNAME/REPLACE_WITH_YOUR_REPOSITORY with your real repo.
3. For local editing install the Decap local proxy:
   npx decap-server
4. Then open /admin locally.
5. For production you can switch the backend to git-gateway if you deploy on Netlify.
