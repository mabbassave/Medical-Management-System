export const parsePatientPortalList = <T,>(response: unknown, resourceName: string): T[] => {
  if (response && typeof response === 'object' && 'success' in response && response.success !== true) {
    throw new Error(`The ${resourceName} service reported an unsuccessful response.`);
  }

  const list = Array.isArray(response)
    ? response
    : response && typeof response === 'object' && 'data' in response
      ? response.data
      : null;

  if (!Array.isArray(list)) {
    throw new Error(`The ${resourceName} service returned an invalid list response.`);
  }

  return list as T[];
};
