# Pawsitive Belize

Static website for a Belmopan cat rescue prototype. The public page is `index.html`. The staff portal is `admin.html`, linked from the public header and footer.

Sponsorship and adoption requests stay in this browser’s `localStorage`. Opening the site on another device or browser starts from the sample cats again. Nothing is sent to a server. No payment is processed, and no account is required.

## GitHub Pages

This repository is ready to publish from the `main` branch. `.nojekyll` is included so GitHub Pages serves the files as they are and does not run Jekyll.

A person with admin access to this repository needs to turn Pages on after these files are on `main`:

1. Open the repository on GitHub and choose **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set the branch to **main** and the folder to **/ (root)**.
4. Save.

GitHub then publishes the project site. The home page is the repository root, which serves `index.html`. The staff portal is the relative page `admin.html` on that same site.

Pages was not enabled from this change. The publishing setting is a repository setting and has to be saved by an admin.

## Local check

From this folder, start a static file server and open the root page and `admin.html` in the same browser. The staff portal can then see requests saved by the public page.

On the staff portal, **Reset sample data** restores the original six cats in that browser.
