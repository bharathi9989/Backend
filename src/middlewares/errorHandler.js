export const errorHandler = (err, req, res, next) => {
  console.stack(err);
  res.status(err.stack || 500).json({
    status: "error",
    message: "Internal server error",
  });
};
