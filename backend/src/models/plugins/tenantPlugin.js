import { HttpError } from '../../utils/httpError.js'

const QUERY_OPS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'updateMany',
  'updateOne',
]

function hasTenantFilter(query, field) {
  if (!query || typeof query !== 'object') return false
  if (Object.prototype.hasOwnProperty.call(query, field)) return true
  if (query.$and && Array.isArray(query.$and))
    return query.$and.some((q) => hasTenantFilter(q, field))
  if (query.$or && Array.isArray(query.$or))
    return query.$or.every((q) => hasTenantFilter(q, field))
  return false
}

export function tenantPlugin(schema, opts = {}) {
  const field = opts.field || 'pharmacyId'

  if (!schema.path(field)) {
    throw new Error(`tenantPlugin requires schema to have a '${field}' path`)
  }

  for (const op of QUERY_OPS) {
    schema.pre(op, function tenantEnforce(next) {
      const query = this.getQuery()
      const skip = this.getOptions?.()?.skipTenantCheck === true
      if (skip) return next()
      if (!hasTenantFilter(query, field)) {
        return next(
          new HttpError(
            500,
            `Tenant isolation violation: '${field}' filter is required for ${op}`,
          ),
        )
      }
      return next()
    })
  }

  schema.pre('aggregate', function tenantAggregateEnforce(next) {
    const skip = this.options?.skipTenantCheck === true
    if (skip) return next()

    const pipeline = this.pipeline()
    const firstMatch = pipeline.find((stage) => stage && stage.$match)
    if (!firstMatch || !hasTenantFilter(firstMatch.$match, field)) {
      return next(
        new HttpError(
          500,
          `Tenant isolation violation: '${field}' $match is required for aggregate`,
        ),
      )
    }
    return next()
  })

  schema.pre('save', function tenantSaveEnforce(next) {
    const doc = this
    if (doc.isNew && !doc.get(field)) {
      return next(
        new HttpError(500, `Tenant isolation violation: '${field}' is required`),
      )
    }
    return next()
  })

  schema.pre('insertMany', function tenantInsertManyEnforce(next, docs) {
    for (const doc of docs || []) {
      if (!doc[field]) {
        return next(
          new HttpError(500, `Tenant isolation violation: '${field}' is required`),
        )
      }
    }
    return next()
  })
}

