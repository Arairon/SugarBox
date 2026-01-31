export const dbSchema = {
  name: "sugarbox",
  version: 1,
  stores: {
    games: `++id,remoteId,&uuid,name,shortname,archived,archivedAt,createdAt,updatedAt,syncStatus,syncedAt`,
    chars: `++id,remoteId,&uuid,name,gameId,archived,archivedAt,createdAt,updatedAt,syncStatus,syncedAt`,
    saves: `++id,remoteId,&uuid,name,hash,gameVersion,charId,gameId,createdAt,archived,archivedAt,updatedAt,syncStatus,syncedAt`,
  }
}
