export function isHotkeyMatch(e: KeyboardEvent, hotkey: string): boolean {
  if (!hotkey) return false;
  
  const parts = hotkey.split('+');
  const key = parts[parts.length - 1].toLowerCase();
  
  const mod = parts.includes('mod');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');

  const matchesMod = mod ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
  const matchesShift = shift ? e.shiftKey : !e.shiftKey;
  const matchesAlt = alt ? e.altKey : !e.altKey;
  
  // Special case for character keys vs key names
  let eventKey = e.key.toLowerCase();
  if (eventKey === ' ') eventKey = 'space';

  return matchesMod && matchesShift && matchesAlt && eventKey === key;
}
