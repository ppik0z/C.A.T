import { Module } from '@nestjs/common';
import { ReadStateService } from './read-state.service';

@Module({
    providers: [ReadStateService],
    exports: [ReadStateService],
})
export class ReadStateModule { }