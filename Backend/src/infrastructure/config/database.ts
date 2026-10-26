import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';
import { UserModel } from '../database/schemas/User.schema';

/**
 * Sanitizes MongoDB connection URIs to prevent password or credential exposure in logs.
 */
export const sanitizeMongoUri = (uri: string): string => {
  if (!uri) return '[not configured]';
  try {
    const url = new URL(uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://'));
    const isSrv = uri.startsWith('mongodb+srv://');
    const scheme = isSrv ? 'mongodb+srv://' : 'mongodb://';
    const pathname = url.pathname || '';
    return `${scheme}${url.host}${pathname}`;
  } catch {
    return '[invalid MongoDB URI]';
  }
};

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

let listenersAttached = false;
const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connection established.');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB connection lost/disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB connection re-established.');
  });

  mongoose.connection.on('error', (err: Error) => {
    console.error('[MongoDB] Runtime error', { errorName: err.name });
  });
};

/**
 * Validates and ensures DNS SRV resolution works for mongodb+srv:// URIs.
 * On Windows, local router DNS often refuses UDP port 53 for SRV records (querySrv ECONNREFUSED).
 * If local DNS fails, automatically configures reliable public DNS resolvers (8.8.8.8, 1.1.1.1).
 */
export const ensureSrvDnsSupport = async (uri: string): Promise<void> => {
  if (!uri || !uri.startsWith('mongodb+srv://')) return;

  const match = uri.match(/^mongodb\+srv:\/\/(?:[^@]+@)?([^/?#]+)/);
  if (!match) return;

  const hostname = match[1];
  const srvRecord = `_mongodb._tcp.${hostname}`;

  try {
    await dns.promises.resolveSrv(srvRecord);
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
    const currentServers = dns.getServers();
    console.warn(
      `[Database] Local DNS server (${currentServers.join(', ')}) failed SRV resolution for ${hostname} (${code}). ` +
        `Switching Node.js DNS to public resolvers (8.8.8.8, 1.1.1.1) to resolve Atlas cluster...`
    );

    dns.setServers(['8.8.8.8', '1.1.1.1', '1.0.0.1']);

    try {
      const addresses = await dns.promises.resolveSrv(srvRecord);
      console.log(
        `[Database] Public DNS successfully resolved ${addresses.length} MongoDB Atlas shard addresses for ${hostname}.`
      );
    } catch (fallbackError: unknown) {
      const fallbackCode =
        fallbackError && typeof fallbackError === 'object' && 'code' in fallbackError
          ? fallbackError.code
          : 'unknown';
      console.error(
        `[Database] DNS SRV resolution failed even with public resolvers (${fallbackCode}). ` +
          `Network may be blocking UDP port 53 or cluster hostname may be incorrect.`
      );
    }
  }
};

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  attachConnectionListeners();

  await ensureSrvDnsSupport(env.MONGODB_URI);

  const sanitizedTarget = sanitizeMongoUri(env.MONGODB_URI);

  try {
    console.log(`Connecting to MongoDB at ${sanitizedTarget}...`);
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      autoIndex: true,
      family: 4,
    });

    try {
      await UserModel.init();
      const indexes = await UserModel.collection.indexes();
      const legacyPasswordIndex = indexes.find(
        (index) =>
          index.unique === true &&
          index.key?.password === 1 &&
          Object.keys(index.key).length === 1
      );
      if (legacyPasswordIndex?.name) {
        await UserModel.collection.dropIndex(legacyPasswordIndex.name);
      }
    } catch (indexError: unknown) {
      // Do not abort startup if index inspection on a fresh or restricted collection fails
      const errorName = indexError instanceof Error ? indexError.name : 'UnknownError';
      console.warn('[MongoDB] Index initialization note', { errorName });
    }

    console.log(`MongoDB connected successfully to ${sanitizedTarget}`);
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'unknown';

    console.error(
      `❌ Failed to connect to MongoDB at ${sanitizedTarget} (${errorName}, code=${errorCode}).`
    );

    if (['querySrv', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(errorCode)) {
      console.error(
        `👉 DIAGNOSTIC: DNS SRV resolution failed. Your network or router blocks SRV DNS lookups. ` +
          `To bypass SRV DNS entirely, obtain the standard (non-SRV) replica set connection string from MongoDB Atlas ` +
          `(Atlas > Database > Connect > Drivers > select driver version 3.4 or earlier to view the full host list).`
      );
    } else if (errorName === 'MongoServerSelectionError') {
      console.error(
        `👉 DIAGNOSTIC: Atlas cluster unreachable or IP not allowed. In MongoDB Atlas, go to Network Access > IP Access List, and ensure your current IP address (or 0.0.0.0/0) is active.`
      );
    }

    throw new Error(`Database connection failed (${errorName}, code=${errorCode}).`);
  }
};

