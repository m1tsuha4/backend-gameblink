import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class MidtransService {
  private snap;

  constructor(private readonly prisma: PrismaService) {
    this.snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }

async createTransaction(booking: any, paymentType: any) {
  const baseAmount = booking.total_harga;
  let fee = 0;

// Calculate fee based on payment method
switch (paymentType) {
  case 'bank_transfer':
    fee = 4000;
    break;
  case 'gopay':
  case 'shopeepay':
    fee = Math.round(baseAmount * 0.02); // 2%
    break;
  case 'qris':
    fee = Math.round(baseAmount * 0.007); // 0.7%
    break;
  case 'dana':
    fee = Math.round(baseAmount * 0.015); // 1.5%
    break;
  default:
    fee = 0;
}

  const itemDetails = booking.booking_details.map((detail, index) => ({
    id: `unit-${index + 1}`,
    name: `Sewa ${detail.unit_id} @ ${detail.jam_main}`,
    quantity: 1,
    price: detail.harga,
  }));

  // Add convenience fee to item details
  if (fee > 0) {
    itemDetails.push({
      id: 'fee',
      name: 'Convenience Fee',
      quantity: 1,
      price: fee,
    });
  }

  const payload = {
    transaction_details: {
      order_id: `${booking.id} (${booking.booking_code})`,
      gross_amount: baseAmount + fee,
    },
    customer_details: {
      first_name: booking.nama,
      email: booking.email,
      phone: booking.nomor_hp,
    },
    item_details: itemDetails,
    enabled_payments: [paymentType], // restrict to chosen method
  };

  return await this.snap.createTransaction(payload);
}


 async handleNotification(notification: any) {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const paymentType = notification.payment_type;

    const bookingId = orderId.split(' ')[0];

    let status_pembayaran: 'Berhasil' | 'Pending' | 'Gagal';
    let status_booking: 'Aktif' | 'Selesai' | 'Dibatalkan' | 'TidakAktif';

    if (['settlement', 'capture'].includes(transactionStatus)) {
      status_pembayaran = 'Berhasil';
      status_booking = 'Aktif';
    } else if (transactionStatus === 'pending') {
      status_pembayaran = 'Pending';
      status_booking = 'TidakAktif';
    } else {
      status_pembayaran = 'Gagal';
      status_booking = 'Dibatalkan';
    }

    await this.prisma.booking.updateMany({
      where: { id: bookingId },
      data: {
        status_booking,
        status_pembayaran,
        metode_pembayaran: paymentType,
      },
    });

    return { success: true };
  }
}
