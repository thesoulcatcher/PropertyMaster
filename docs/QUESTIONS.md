# Questions for the owner

The brief allows at most three questions in total. No answer is needed to continue Part A.

1. **Push access.** From the build sandbox, git cannot reach github.com:443 ("Bad access"), so the commits could not be pushed. Can you run `git push -u origin main` from `E:\Property Master Build` on your own machine, or confirm a route the build session can use?
2. **Framework for Part B.** Part A uses plain Node with no dependencies. Should the web and desktop shells use React with Vite, or another stack? Reply with one name.
3. **Tax figures.** Purchase tax bands in `src/data/purchase-tax.js` are unverified. Should the next session check each band against gov.uk, Revenue Scotland and the Welsh Revenue Authority before any figure is shown to a member?
