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

  async createTransaction(booking: any) {
    const payload = {
      transaction_details: {
        order_id: `${booking.id} (${booking.booking_code})`,
        gross_amount: booking.total_harga,
      },
      customer_details: {
        first_name: booking.nama,
        email: booking.email,
        phone: booking.nomor_hp,
      },
      item_details: booking.booking_details.map((detail, index) => ({
        id: `unit-${index + 1}`,
        name: `Sewa ${detail.unit?.nama_unit + ' ' + detail.unit?.jenis_konsol || 'Unit'} @ ${detail.jam_main}`,
        quantity: 1,
        price: detail.harga,
      })),
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
