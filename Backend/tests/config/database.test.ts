import { describe, expect, it } from 'vitest';
import { sanitizeMongoUri } from '../../src/infrastructure/config/database';

describe('sanitizeMongoUri', () => {
  it('omits usernames and passwords from standard and SRV connection strings', () => {
    expect(sanitizeMongoUri('mongodb://db-user:db-password@localhost:27017/medical')).toBe(
      'mongodb://localhost:27017/medical'
    );
    expect(sanitizeMongoUri('mongodb+srv://db-user:db-password@cluster.example/medical')).toBe(
      'mongodb+srv://cluster.example/medical'
    );
  });

  it('does not echo malformed connection strings', () => {
    expect(sanitizeMongoUri('sensitive-malformed-uri')).toBe('[invalid MongoDB URI]');
  });
});
