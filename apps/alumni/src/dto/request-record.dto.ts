import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DocumentType } from '../interfaces/alumni.interface';

export class RequestRecordDto {
  @IsUUID()
  actor_uuid: string;

  @IsString()
  tenant_id: string;

  @IsEnum(DocumentType)
  document_type: DocumentType;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsIn(['pickup', 'delivery', 'courier'])
  @IsOptional()
  delivery_method?: 'pickup' | 'delivery' | 'courier';

  @IsInt()
  @Min(1)
  @IsOptional()
  number_of_copies?: number;
}
