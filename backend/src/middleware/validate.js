export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body)
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }
      req.validatedBody = result.data
      return next()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid request'
      return res.status(400).json({ error: msg })
    }
  }
}
