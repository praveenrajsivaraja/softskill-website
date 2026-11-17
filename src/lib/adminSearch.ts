export const filterRecordsBySearch = <T>(
  records: T[],
  searchTerm: string,
  readSearchableText: (record: T) => Array<string | null | undefined>,
): T[] => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return records;
  }

  return records.filter((record) =>
    readSearchableText(record).some((value) => value?.toLowerCase().includes(query)),
  );
};
