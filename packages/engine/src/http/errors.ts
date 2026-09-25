// Every API failure leaves as `{ error, message, field?, requestId }`, the shape Helix's API uses.
import { API_INTERNAL, apiInvalidRequestError } from '@sparky/core'
import type { z } from 'zod/v4'
import { OpInputError, type OpInputCode } from '../ops'

export type ApiErrorCode = 'unauthorized' | 'invalid_request' | 'not_found' | 'internal_error' | OpInputCode

export interface ApiErrorBody {
  error: ApiErrorCode
  message: string
  field?: string
  requestId: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const OP_STATUS: Record<OpInputCode, number> = {
  invalid_input: 400,
  unknown_op: 404,
  unavailable: 422,
}

/** A body that doesn't match the route's schema. */
export function invalidRequest(error: z.core.$ZodError): ApiError {
  const where = (p: PropertyKey[]) => p.map(String).join('.')
  const problems = error.issues.map((i) => (i.path.length ? `${where(i.path)}: ${i.message}` : i.message))
  const first = error.issues[0]
  return new ApiError(400, 'invalid_request', apiInvalidRequestError(problems), first?.path.length ? where(first.path) : undefined)
}

/** Status and body for anything a route or hook threw. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  if (e instanceof OpInputError) return new ApiError(OP_STATUS[e.code], e.code, e.message, e.field)
  const status = (e as { statusCode?: unknown }).statusCode
  // Fastify's own 4xx: malformed JSON, a body it can't read.
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const badJson = (e as { code?: unknown }).code === 'FST_ERR_CTP_INVALID_JSON_BODY' || e instanceof SyntaxError
    return new ApiError(400, 'invalid_request', apiInvalidRequestError(badJson ? [] : [(e as Error).message]))
  }
  return new ApiError(500, 'internal_error', API_INTERNAL)
}

export function errorBody(e: ApiError, requestId: string): ApiErrorBody {
  return { error: e.code, message: e.message, ...(e.field === undefined ? {} : { field: e.field }), requestId }
}
