export const version = {
  major: 0,
  minor: 2,
  patch: 0,
  mod: "dev",
};

export function getVersionString(includeMod = true) {
  const { major, minor, patch, mod } = version;
  if (includeMod) return `${major}.${minor}.${patch}${mod}`;
  return `${major}.${minor}.${patch}`;
}
