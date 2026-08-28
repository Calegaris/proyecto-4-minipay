import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TransferStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TransferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado de la transferencia',
    enum: TransferStatus,
    example: TransferStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(TransferStatus, {
    message: 'El estado debe ser PENDING, COMPLETED o FAILED',
  })
  status?: TransferStatus;
}
