import str, { buffer } from 'get-stream';
import { Stream } from 'stream';
import { Logger } from '@verdaccio/types';
import { Client as MinioClient } from 'minio';
import { ClientConfig } from './config';

const DEFAULT_BUCKET = 'verdaccio';
const DEFAULT_REGION = 'us-east-1';

/**
 * Wrapper around the default Minio Client, mostly to provide high-level methods with
 * lots of debug messages and some decorated errors.
 *
 * This implementation is fixed on a bucket, so you can't operate in multiple buckets
 * at a time.
 */
export default class Client {
  private logger: Logger;
  private client: MinioClient;
  private bucket: string;
  private region: string;

  public constructor(config: ClientConfig, logger: Logger) {
    if (!config.endPoint) {
      throw new Error('Minio storage requires an endpoint');
    }

    if (!config.accessKey) {
      throw new Error('Minio storage requires an access key');
    }

    if (!config.secretKey) {
      throw new Error('Minio storage requires a secret key');
    }

    this.bucket = config.bucket ? config.bucket : DEFAULT_BUCKET;
    this.region = config.region ? config.region : DEFAULT_REGION;
    this.logger = logger;
    this.client = new MinioClient({
      port: config.port || 443,
      region: this.region,
      endPoint: config.endPoint,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      useSSL: config.useSSL || true,
    });
  }

  /**
   * Initialize the client by making sure the bucket exist in minio.
   */
  public async initialize(): Promise<void> {
    try {
      const exist = await this.client.bucketExists(this.bucket);
      if (!exist) {
        this.debug({}, 'Minio: Bucket @{bucket} does not exist, creating it');
        await this.client.makeBucket(this.bucket, this.region);
        this.debug({}, 'Minio: Bucket @{bucket} creating successfully');
      } else {
        this.debug({}, 'Minio: Bucket @{bucket} already exist, keep going');
      }
    } catch (error) {
      throw new Error(`Failed to ensure bucket ${this.bucket} exist: ${error}`);
    }
  }

  public async get(name: string): Promise<string> {
    return str(await this.client.getObject(this.bucket, name));
  }

  public async getBuffer(name: string): Promise<Buffer> {
    return buffer(await this.client.getObject(this.bucket, name));
  }

  public async getStream(name: string): Promise<Stream> {
    return await this.client.getObject(this.bucket, name);
  }

  public async put(name: string, data: Buffer | Stream | string): Promise<string> {
    return await this.client.putObject(this.bucket, name, data);
  }

  private debug(conf: any, template: string): void {
    this.logger.debug(
      {
        bucket: this.bucket,
        region: this.region,
        ...conf,
      },
      template
    );
  }
}