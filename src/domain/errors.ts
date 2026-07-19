export class DomainError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  public constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class PersistenceError extends DomainError {
  public constructor(message: string) {
    super(message, "PERSISTENCE_ERROR");
  }
}

export class ImportError extends DomainError {
  public constructor(message: string) {
    super(message, "IMPORT_ERROR");
  }
}

export class PermissionError extends DomainError {
  public constructor(message: string) {
    super(message, "PERMISSION_ERROR");
  }
}

export class DuplicateError extends DomainError {
  public constructor(
    message: string,
    public readonly existingId: string,
  ) {
    super(message, "DUPLICATE_ERROR");
  }
}
