## New Release
- pnpm build <- check if its buildling
- change version in package.json
- pnpm run version
- check in latest commits
- git tag -a 0.0.x -m "0.0.x"
- git push origin 0.0.x

## Remove Tag
git tag -d 0.0.x
git push origin :refs/tags/0.0.x
git tag 0.0.x
git push origin 0.0.x
