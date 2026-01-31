export const version = {
  major: 0,
  minor: 1,
  patch: 3,
  mod: "dev",
};

export function getVersionString(includeMod = true) {
  const { major, minor, patch, mod } = version;
  if (includeMod) return `${major}.${minor}.${patch}${mod}`;
  return `${major}.${minor}.${patch}`;
}
