// 3-char "all" on left, 4-char "code" on right
// Left: 'a' (lowercase rounded block), 'l' (tall pipe), 'l' (tall pipe)
// Notice in opencode 'o' was:
// █▀▀█
// █__█
// ▀▀▀▀
// An 'a' with top curve, right stem, middle crossbar:
// █▀▀█
// █▀▀█
// ▀▀▀▀
// Or lowercase 'a':
// ▄▀▀█
// █__█
// ▀▀▀▀
export const logo = {
  left: [
    "                   ",
    "▄▀▀█ █    █        ",
    "█__█ █    █        ",
    "▀▀▀▀ ▀▀▀▀ ▀▀▀▀     ",
  ],
  right: [
    "             ▄     ",
    "█▀▀▀ █▀▀█ █▀▀█ █▀▀█",
    "█___ █__█ █__█ █^^^",
    "▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀",
  ],
}

export const go = {
  left: ["    ", "▄▀▀█", "█__█", "▀▀▀▀"],
  right: ["    ", "█▀▀▀", "█___", "▀▀▀▀"],
}

export const marks = "_^~,"
