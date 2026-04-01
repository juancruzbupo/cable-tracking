import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { Roles } from '../auth/roles.decorator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const fileUpload = () =>
  FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (
        file.originalname.match(/\.(xlsx|xls)$/i) ||
        file.mimetype.includes('spreadsheet') ||
        file.mimetype.includes('excel') ||
        file.mimetype === 'application/octet-stream'
      ) {
        cb(null, true);
      } else {
        cb(
          new BadRequestException('Solo se aceptan archivos Excel (.xlsx, .xls)'),
          false,
        );
      }
    },
  });

@ApiTags('Import')
@Roles('ADMIN')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  // ── Preview ────────────────────────────────────────────────

  @Post('preview/clientes')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async previewClientes(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.previewFile(file.buffer, 'CLIENTES');
  }

  @Post('preview/ramitos')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async previewRamitos(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.previewFile(file.buffer, 'RAMITOS');
  }

  @Post('preview/facturas')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async previewFacturas(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.previewFile(file.buffer, 'FACTURAS');
  }

  // ── Execute ────────────────────────────────────────────────

  @Post('clientes')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async importClientes(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.importClients(file.buffer, file.originalname);
  }

  @Post('ramitos')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async importRamitos(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.importDocuments(
      file.buffer,
      file.originalname,
      'RAMITOS',
    );
  }

  @Post('facturas')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  async importFacturas(@UploadedFile() file: Express.Multer.File) {
    this.requireFile(file);
    return this.importService.importDocuments(
      file.buffer,
      file.originalname,
      'FACTURAS',
    );
  }

  // ── Logs ───────────────────────────────────────────────────

  @Get('logs')
  @Roles('ADMIN', 'OPERADOR')
  getLogs(@Query('limit') limit?: number) {
    return this.importService.getImportLogs(
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }

  // ── Helper ─────────────────────────────────────────────────

  private requireFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
  }
}
