export const dbSchema = {
  name: "sugarbox",
  version: 1,
  stores: {
    games: `++id,remoteId,&uuid,name,shortname,archived,archivedAt,createdAt,updatedAt`,
    chars: `++id,remoteId,&uuid,name,gameId,archived,archivedAt,createdAt,updatedAt`,
    saves: `++id,remoteId,&uuid,name,hash,gameVersion,charId,gameId,archived,archivedAt,createdAt,updatedAt`,
  }
}
