import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TransactionCategory, TransactionType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de transacción',
    enum: TransactionType,
    example: TransactionType.DEPOSIT,
  })
  @IsOptional()
  @IsEnum(TransactionType, {
    message:
      'El tipo de transacción debe ser DEPOSIT, TRANSFER_SENT, TRANSFER_RECEIVED o YIELD',
  })
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría o rubro de transacción',
    enum: TransactionCategory,
    example: TransactionCategory.FOOD,
  })
  @IsOptional()
  @IsEnum(TransactionCategory, {
    message:
      'La categoría debe ser una de las siguientes: SERVICES, FOOD, HOUSING, ENTERTAINMENT, GENERAL_TRANSFER, YIELD, OTHER',
  })
  category?: TransactionCategory;
}
