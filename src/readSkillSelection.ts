type ResolveSelectedPathAfterReadInput = {
  currentSelectedPath: string;
  requestedPath: string;
  readSucceeded: boolean;
  clearOnFailure: boolean;
};

export function resolveSelectedPathAfterRead({
  currentSelectedPath,
  requestedPath,
  readSucceeded,
  clearOnFailure,
}: ResolveSelectedPathAfterReadInput): string {
  if (readSucceeded) {
    return requestedPath;
  }

  return clearOnFailure ? "" : currentSelectedPath;
}
