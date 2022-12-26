/*
  Free and open source - GNU LGPLv3
  Copyright © 2022
  Afonso Barracha
*/

import { DynamicModule, Global, Module } from '@nestjs/common';
import { UPLOADER_OPTIONS } from './constants/options.constant';
import { IOptions } from './interfaces/options.interface';
import { UploaderService } from './uploader.service';

@Global()
@Module({})
export class UploaderModule {
  public static forRoot(options: IOptions): DynamicModule {
    return {
      global: true,
      module: UploaderModule,
      providers: [
        {
          provide: UPLOADER_OPTIONS,
          useValue: options,
        },
        UploaderService,
      ],
      exports: [UploaderService],
    };
  }
}
