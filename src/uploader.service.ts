/*
  Free and open source - GNU LGPLv3
  Copyright © 2022
  Afonso Barracha
*/

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  LoggerService,
} from '@nestjs/common';
import sharp from 'sharp';
import { Readable } from 'stream';
import { v4 as uuidV4, v5 as uuidV5 } from 'uuid';
import { UPLOADER_OPTIONS } from './constants/options.constant';
import {
  IMAGE_SIZE,
  MAX_WIDTH,
  QUALITY_ARRAY,
} from './constants/uploader.constant';
import { FileUploadDto } from './dtos/file-upload.dto';
import { RatioEnum } from './enums/ratio.enum';
import { IBucketData } from './interfaces/bucket-data.interface';
import { IOptions } from './interfaces/options.interface';

@Injectable()
export class UploaderService {
  private readonly client: S3Client;
  private readonly bucketData: IBucketData;
  private readonly loggerService: LoggerService;

  constructor(@Inject(UPLOADER_OPTIONS) options: IOptions) {
    this.client = new S3Client(options.clientConfig);
    this.bucketData = options.bucketData;
    this.loggerService = new Logger(UploaderService.name);
  }

  private static validateImage(mimetype: string): string | false {
    const val = mimetype.split('/');
    if (val[0] !== 'image') return false;

    return val[1] ?? false;
  }

  private static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const buffer: Uint8Array[] = [];

    return new Promise((resolve, reject) =>
      stream
        .on('error', (error) => reject(error))
        .on('data', (data) => buffer.push(data))
        .on('end', () => resolve(Buffer.concat(buffer))),
    );
  }

  private static async compressImage(
    buffer: Buffer,
    ratio?: number,
  ): Promise<Buffer> {
    let compressBuffer: sharp.Sharp | Buffer = sharp(buffer).jpeg({
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    });

    if (ratio) {
      compressBuffer.resize({
        width: MAX_WIDTH,
        height: Math.round(MAX_WIDTH * ratio),
        fit: 'cover',
      });
    }

    compressBuffer = await compressBuffer.toBuffer();

    if (compressBuffer.length > IMAGE_SIZE) {
      for (let i = 0; i < QUALITY_ARRAY.length; i++) {
        const quality = QUALITY_ARRAY[i];
        const smallerBuffer = await sharp(compressBuffer)
          .jpeg({
            quality,
            chromaSubsampling: '4:4:4',
          })
          .toBuffer();

        if (smallerBuffer.length <= IMAGE_SIZE || quality === 10) {
          compressBuffer = smallerBuffer;
          break;
        }
      }
    }

    return compressBuffer;
  }

  /**
   * Upload Image
   *
   * Converts an image to jpeg and uploads it to the bucket
   */
  public async uploadImage(
    userId: number,
    file: Promise<FileUploadDto>,
    ratio?: RatioEnum,
  ): Promise<string> {
    const { mimetype, createReadStream } = await file;
    const imageType = UploaderService.validateImage(mimetype);

    if (!imageType) {
      throw new BadRequestException('Please upload a valid image');
    }

    try {
      return await this.uploadFile(
        userId,
        await UploaderService.compressImage(
          await UploaderService.streamToBuffer(createReadStream()),
          ratio,
        ),
        '.jpg',
      );
    } catch (error) {
      this.loggerService.error(error);
      throw new InternalServerErrorException('Error uploading image');
    }
  }

  /**
   * Delete File
   *
   * Takes a file url and deletes the file from the bucket
   */
  public deleteFile(url: string): void {
    const keyArr = url.split('.com/');

    if (keyArr.length !== 2 || !this.bucketData.url.includes(keyArr[0])) {
      this.loggerService.error('Invalid url to delete file');
    }

    this.client
      .send(
        new DeleteObjectCommand({
          Bucket: this.bucketData.name,
          Key: keyArr[1],
        }),
      )
      .then(() => this.loggerService.log('File deleted successfully'))
      .catch((error) => this.loggerService.error(error));
  }

  private async uploadFile(
    userId: number,
    fileBuffer: Buffer,
    fileExt: string,
  ): Promise<string> {
    const key =
      this.bucketData.folder +
      '/' +
      uuidV5(userId.toString(), this.bucketData.appUuid) +
      '/' +
      uuidV4() +
      fileExt;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketData.name,
          Body: fileBuffer,
          Key: key,
          ACL: 'public-read',
        }),
      );
    } catch (error) {
      this.loggerService.error(error);
      throw new InternalServerErrorException('Error uploading file');
    }

    return this.bucketData.url + key;
  }
}
