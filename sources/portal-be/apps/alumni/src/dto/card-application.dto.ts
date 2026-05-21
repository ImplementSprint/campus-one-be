import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CardApplicationDto {
  @IsUUID()
  actor_uuid: string;

  @IsString()
  tenant_id: string;

  @IsIn(['new', 'replacement'])
  application_type: 'new' | 'replacement';

  @IsIn(['pickup', 'delivery'])
  delivery_method: 'pickup' | 'delivery';

  @IsString()
  @IsOptional()
  id_photo_url?: string;
}
