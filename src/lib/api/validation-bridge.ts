/**
 * Regroupement pratique des utilitaires de validation et de réponse HTTP.
 * Évite les doubles imports dans les routes API.
 */
export {
  arrayField,
  bool,
  city,
  email,
  int,
  isRecord,
  madAmount,
  oneOf,
  password,
  phone,
  str,
  throwIfInvalid,
  uuidValue,
  ValidationError,
  type FieldErrors,
} from "@/lib/validation";

export {
  ApiError,
  badRequest,
  conflict,
  created,
  fail,
  forbidden,
  notFound,
  ok,
  parsePagination,
  paginationMeta,
  paymentRequired,
  readJson,
  readRawBody,
  serverError,
  tooManyRequests,
  unauthorized,
  withErrorHandling,
} from "@/lib/api/respond";
