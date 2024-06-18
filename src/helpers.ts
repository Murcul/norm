export const quoteAndJoin = (
  list: Array<string | number | symbol>,
  prefix?: string,
): string => {
  const uniqueColumns = [...new Set(list)];
  return uniqueColumns.map((el) =>
    prefix ? `${prefix}."${String(el)}"` : `"${String(el)}"`
  ).join(', ');
};
