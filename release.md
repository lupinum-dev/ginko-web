## New Release
pnpm build <- check if its buildling
change version in package.json
pnpm run version
check in latest commits
git tag -a 0.0.1 -m "0.0.1"
git push origin 0.0.1

## Remove Tag
git tag -d 0.0.1
git push origin :refs/tags/0.0.1
git tag 0.0.1
git push origin 0.0.1
