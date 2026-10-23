// Chooses a bundled avatar for new accounts and empty profiles before persisting it.
import { randomInt } from "node:crypto";
import { DEFAULT_AVATARS } from "../../../shared/contracts/index.js";

export function randomDefaultAvatar() {
  return DEFAULT_AVATARS[randomInt(DEFAULT_AVATARS.length)]!;
}
