export const isUniqueViolation = (error) => error?.code === "23505";
export const isForeignKeyViolation = (error) => error?.code === "23503";
