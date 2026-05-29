export interface ItemDisplayName {
  primary: string;
  secondary: string | null;
}

export interface NamedLine {
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
}

const splitPatterns = [
  /\s+con\s+/i,
  /,\s*/,
];

export function getItemDisplayName(item: NamedLine): ItemDisplayName {
  const primaryName = item.primaryName?.trim();
  const secondaryName = item.secondaryName?.trim();

  if (primaryName) {
    return {
      primary: primaryName,
      secondary: secondaryName || null,
    };
  }

  const name = item.name.trim();
  for (const pattern of splitPatterns) {
    const match = pattern.exec(name);
    if (match && match.index > 0) {
      const primary = name.slice(0, match.index).trim();
      const secondary = name.slice(match.index + match[0].length).trim();
      if (primary && secondary) {
        return { primary, secondary };
      }
    }
  }

  return { primary: name, secondary: null };
}

export function getItemDisplayText(item: NamedLine): string {
  const displayName = getItemDisplayName(item);
  return displayName.secondary ? `${displayName.primary} ${displayName.secondary}` : displayName.primary;
}
