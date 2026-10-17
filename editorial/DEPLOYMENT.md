# GitHub Pages

The editorial source is in `editorial/` on the repository's `website-download` branch. The original downloadable website archive is retained.

The separate `gh-pages` branch contains only the built static editorial site and a `.nojekyll` file. This avoids changing the source branch into a generated output directory. The build uses relative asset URLs for the repository project path.

GitHub Pages configuration:

- Repository: `piyushrajput2chouhan-gif/Codex`
- Source: **Deploy from a branch**
- Branch: **gh-pages**
- Folder: **/ (root)**
- Published Pages URL: `https://piyushrajput2chouhan-gif.github.io/Codex/`

The editorial build deployed successfully in [GitHub Pages run 39022484075](https://github.com/piyushrajput2chouhan-gif/Codex/actions/runs/39022484075), for deployment commit `4515e5eb623ba0506764c029cef2af4cc414eaa7`.

Repository Pages settings: https://github.com/piyushrajput2chouhan-gif/Codex/settings/pages

To update the production files, run `npm ci` and `npm run build` from `editorial/`. Publish the contents of `dist/` at the root of the `gh-pages` branch, retain `.nojekyll`, and push a normal commit. Do not force-push over another deployment or add a custom domain without inspecting its existing configuration.

Pushing a branch does not by itself prove that Pages is enabled or that the website is live. Verify GitHub's Pages deployment and the public URL after configuration.
