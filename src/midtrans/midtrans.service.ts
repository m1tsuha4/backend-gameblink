import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class MidtransService {
  private snap;

  constructor(private readonly prisma: PrismaService) {
    this.snap = new midtransClient.Snap({
      isProduction: true,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }

async createTransaction(booking: any, paymentType?: string) { // Jadikan paymentType opsional dengan '?'
    const baseAmount = booking.total_harga;
    let fee = 0;
    
    // Salin item details asli agar tidak termutasi
    const itemDetails = booking.booking_details.map((detail, index) => ({
      id: `unit-${index + 1}`,
      name: `Sewa ${detail.unit_id} @ ${detail.jam_main}`,
      quantity: 1,
      price: detail.harga,
    }));

    // Siapkan payload dasar
    const payload: any = { // Gunakan 'any' untuk fleksibilitas properti
      transaction_details: {
        order_id: `${booking.id} (${booking.booking_code})`,
      },
      customer_details: {
        first_name: booking.nama,
        email: booking.email,
        phone: booking.nomor_hp,
      },
      item_details: itemDetails,
    };
    
    // Cek jika paymentType diberikan (pengguna memilih di awal)
    if (paymentType) {
      // Hitung fee berdasarkan metode yang dipilih
      switch (paymentType) {
        case 'bank_transfer':
          fee = 4000;
          break;
        case 'gopay':
        case 'shopeepay':
          fee = Math.round(baseAmount * 0.02); // 2%
          break;
        case 'other_qris':
          fee = Math.round(baseAmount * 0.007); // 0.7%
          break;
        case 'dana':
          fee = Math.round(baseAmount * 0.015); // 1.5%
          break;
        default:
          fee = 0;
      }

      // Tambahkan fee ke item_details jika ada
      if (fee > 0) {
        payload.item_details.push({
          id: 'fee',
          name: 'Convenience Fee',
          quantity: 1,
          price: fee,
        });
      }
      
      // Atur total harga dan kunci metode pembayaran
      payload.transaction_details.gross_amount = baseAmount + fee;
      payload.enabled_payments = [paymentType];

    } else {
      payload.transaction_details.gross_amount = baseAmount; 
    }

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
