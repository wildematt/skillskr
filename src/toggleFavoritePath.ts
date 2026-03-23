export function toggleFavoritePath(favorites: string[], path: string): string[] {
  return favorites.includes(path) ? favorites.filter((item) => item !== path) : [...favorites, path];
}
