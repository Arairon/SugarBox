import { formatTime } from "@/shared/utils";
import { downloadBlob } from "./browser";
import { db } from "./db";
import type { SaveObj } from "@/shared/types";

export async function exportSaveToFile(save: SaveObj) {
  const blob = new Blob([save.data]);
  const game = await db.games.get({ uuid: save.gameId });
  const gamename = game?.name?.replaceAll(" ", "_") ?? "Unknown game";
  downloadBlob(
    blob,
    `${gamename}-${save.name}_${formatTime(save.createdAt, true)}.save`
  );
}
