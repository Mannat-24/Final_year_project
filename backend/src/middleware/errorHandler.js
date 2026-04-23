export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== "production" ? { stack: error.stack } : {})
  });
};