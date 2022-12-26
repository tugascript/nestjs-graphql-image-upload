/*
  Free and open source - GNU LGPLv3
  Copyright © 2022
  Afonso Barracha
*/

import { ArgsType, Field } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidatePromise } from 'class-validator';
import { GraphQLUpload } from 'graphql-upload';
import { FileUploadDto } from './file-upload.dto';

@ArgsType()
export abstract class PictureDto {
  @Field(() => GraphQLUpload)
  @ValidatePromise()
  @Type(() => FileUploadDto)
  public picture: Promise<FileUploadDto>;
}
