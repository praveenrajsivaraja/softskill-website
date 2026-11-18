export const onlineUsersChannel = 'kiki-online-users';

export interface OnlinePresence {
  userId?: unknown;
}

export const collectOnlineUserIds = (state: Record<string, OnlinePresence[]>): Set<string> => {
  const ids = new Set<string>();
  for (const presences of Object.values(state)) {
    for (const presence of presences) {
      if (typeof presence.userId === 'string' && presence.userId.length > 0) {
        ids.add(presence.userId);
      }
    }
  }
  return ids;
};

export const sameUserIds = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) {
    return false;
  }
  for (const id of left) {
    if (!right.has(id)) {
      return false;
    }
  }
  return true;
};
