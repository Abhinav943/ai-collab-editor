export const errorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    err.status = 400;
    err.code = err.code || 'VALIDATION_ERROR';
  } else if (err.code === 11000) {
    err.status = 409;
    err.code = 'DUPLICATE_KEY';
    err.message = 'Username or email already taken';
  }
  const statusCode = err.status && err.status >= 400 ? err.status : (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === 'production';
  if (statusCode >= 500) console.error('[error]', err.message);

  res.status(statusCode);
  res.json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      // In production, never leak internals for 5xx. In development (and for
      // AI provider errors, which are 502), show the real message so the cause
      // — e.g. an invalid API key — is visible.
      message: statusCode >= 500 && isProduction && err.code !== 'AI_PROVIDER_ERROR'
        ? 'An unexpected server error occurred'
        : (err.message || 'Request failed'),
    },
  });
};
