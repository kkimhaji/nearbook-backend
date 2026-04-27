import { IsEnum } from 'class-validator';

export class UpdateBleVisibilityDto {
    @IsEnum(['public', 'friends_only', 'hidden'])
    bleVisibility: 'public' | 'friends_only' | 'hidden';
}