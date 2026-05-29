export interface ItemDisplayName {
  primary: string;
  secondary: string | null;
}

export interface NamedLine {
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
}

function cleanDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return /^\.+$/.test(trimmed) ? '' : trimmed;
}

export function getItemDisplayName(item: NamedLine): ItemDisplayName {
  const primaryName = cleanDisplayName(item.primaryName);
  const secondaryName = cleanDisplayName(item.secondaryName);

  if (primaryName) {
    return {
      primary: primaryName,
      secondary: secondaryName || null,
    };
  }

  const name = item.name.trim();
  return { primary: name, secondary: null };
}

export function getItemDisplayText(item: NamedLine): string {
  const displayName = getItemDisplayName(item);
  return displayName.secondary ? `${displayName.primary} ${displayName.secondary}` : displayName.primary;
}
