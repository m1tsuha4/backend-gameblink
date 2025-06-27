import { Body, Controller, Post, Req, Res, UsePipes } from '@nestjs/common';
import { MidtransService } from './midtrans.service';
import { CreatePaymentDto, CreatePaymentSchema } from './dto/create-payment.dto';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';

@Controller('midtrans')
export class MidtransController {
  constructor(private readonly midtransService: MidtransService) {}
  
  // @Post('checkout')
  // @UsePipes(new ZodValidationPipe(CreatePaymentSchema))
  // async checkout(@Body() dto: CreatePaymentDto) {
  //   const transaction = await this.midtransService.createTransaction(dto.booking_id);

  //   return {
  //     token: transaction.token,
  //     redirect_url: transaction.redirect_url,
  //   };
  // }
  @Post('notification')
  async handleNotification(@Req() req, @Res() res) {
    const notification = req.body;

    await this.midtransService.handleNotification(notification);

    return res.status(200).send('OK');
  }
}
