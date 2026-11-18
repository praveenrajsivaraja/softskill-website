export interface MenuOrderStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = (userId: string) => `admin_menu_order_${userId}`;

export const reorderMenuItems = <T extends { path: string }>(
  items: T[],
  draggedPath: string,
  targetPath: string,
): T[] => {
  const fromIndex = items.findIndex((item) => item.path === draggedPath);
  const toIndex = items.findIndex((item) => item.path === targetPath);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const nextItems = items.slice();
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
};

export const applySavedMenuOrder = <T extends { path: string }>(
  items: T[],
  savedPaths: string[] | null,
): T[] => {
  if (!savedPaths?.length) {
    return items;
  }

  const itemsByPath = new Map(items.map((item) => [item.path, item]));
  const orderedItems: T[] = [];
  const seenPaths = new Set<string>();

  for (const path of savedPaths) {
    const item = itemsByPath.get(path);
    if (!item || seenPaths.has(path)) {
      continue;
    }
    orderedItems.push(item);
    seenPaths.add(path);
  }

  for (const item of items) {
    if (!seenPaths.has(item.path)) {
      orderedItems.push(item);
    }
  }

  return orderedItems;
};

export const readAdminMenuOrder = (
  userId: string | undefined,
  storage: MenuOrderStorage,
): string[] | null => {
  if (!userId) {
    return null;
  }

  try {
    const rawOrder = storage.getItem(storageKey(userId));
    if (!rawOrder) {
      return null;
    }
    const parsedOrder = JSON.parse(rawOrder) as unknown;
    if (!Array.isArray(parsedOrder) || parsedOrder.some((path) => typeof path !== 'string')) {
      return null;
    }
    return parsedOrder;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin_menu_order_read_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return null;
  }
};

export const writeAdminMenuOrder = (
  userId: string | undefined,
  paths: string[],
  storage: MenuOrderStorage,
): void => {
  if (!userId) {
    return;
  }

  try {
    storage.setItem(storageKey(userId), JSON.stringify(paths));
  } catch (error) {
    console.error(JSON.stringify({
      event: 'admin_menu_order_save_failed',
      message: error instanceof Error ? error.message : 'unknown',
    }));
  }
};
