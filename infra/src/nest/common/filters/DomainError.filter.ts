import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  OutOfStockError,
} from "@shopeer/domain";
import type { Response } from "express";

/**
 * Translates business errors thrown by the domain / use cases into HTTP
 * responses, so that inner layers never deal with HTTP status codes.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  public catch(error: DomainError, host: ArgumentsHost): void {
    const response: Response = host.switchToHttp().getResponse<Response>();
    const statusCode: HttpStatus = toStatusCode(error);

    response.status(statusCode).json({
      statusCode,
      error: error.name,
      message: error.message,
      ...(error instanceof OutOfStockError ? { productIds: error.productIds, } : {}),
    });
  }
}

function toStatusCode(error: DomainError): HttpStatus {
  if (error instanceof NotFoundError) {
    return HttpStatus.NOT_FOUND;
  }

  if (error instanceof ConflictError) {
    return HttpStatus.CONFLICT;
  }

  // InvalidParametersError and any other rule violation: the request is wrong.
  return HttpStatus.BAD_REQUEST;
}
