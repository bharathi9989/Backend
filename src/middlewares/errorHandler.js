export const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.statusCode || 500;
  res.status(status).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
};
