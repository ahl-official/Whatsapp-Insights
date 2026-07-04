export function isGroupOrBroadcast(chatId: string): boolean {
  return chatId.endsWith('@g.us') || chatId.endsWith('@broadcast');
}
