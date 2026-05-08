import { IsEnum } from 'class-validator';
import { GuestbookVisibility } from '../../user/dto/update-guestbook-visibility.dto';

export class UpdateEntryVisibilityDto {
    @IsEnum(GuestbookVisibility)
    visibility: GuestbookVisibility;
}