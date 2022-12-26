/*
  Free and open source - GNU LGPLv3
  Copyright © 2022
  Afonso Barracha
*/

import { IsMimeType, IsString } from 'class-validator';
import { ReadStream } from 'fs';

export abstract class FileUploadDto {
  @IsString()
  public filename!: string;

  @IsString()
  @IsMimeType()
  public mimetype!: string;

  @IsString()
  public encoding!: string;

  public createReadStream: () => ReadStream;
}
