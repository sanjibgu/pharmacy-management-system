export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err)

  const isDup =
    err &&
    typeof err === 'object' &&
    (err.code === 11000 || err.errorResponse?.code === 11000 || err.cause?.code === 11000)

  const status = isDup ? 409 : err.statusCode || 500
  const message =
    err.publicMessage ||
    (isDup ? 'Duplicate record already exists.' : err.message) ||
    'Internal server error'
  res.status(status).json({ error: message })
}
