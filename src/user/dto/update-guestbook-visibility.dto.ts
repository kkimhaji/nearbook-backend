import { IsEnum } from 'class-validator';

export enum GuestbookVisibility {
    PRIVATE = 'private',
    FRIENDS_ONLY = 'friends_only',
}

export class UpdateGuestbookVisibilityDto {
    @IsEnum(GuestbookVisibility)
    guestbookVisibility: GuestbookVisibility;
}